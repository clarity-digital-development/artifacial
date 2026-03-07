import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { enhanceVideoPrompt } from "@/lib/anthropic";
import { getVideoQueue } from "@/lib/queue";
import { CREDIT_COSTS } from "@/lib/stripe";
import { getAvailableCredits, deductCredits } from "@/lib/credits";
import { uploadToR2, r2KeyForProjectSource } from "@/lib/r2";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { id: projectId } = await params;

    // Parse FormData (supports file uploads for face swap / image2video)
    const formData = await req.formData();
    const mode = (formData.get("mode") as string) ?? "text2video";
    const prompt = (formData.get("prompt") as string) ?? "";
    const duration = (formData.get("duration") as string) ?? "5";
    const aspectRatio = (formData.get("aspectRatio") as string) ?? "16:9";
    const sourceVideoFile = formData.get("sourceVideo") as File | null;
    const sourceImageFile = formData.get("sourceImage") as File | null;

    // Validate per mode
    if (mode === "text2video" && !prompt.trim()) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }
    if (mode === "faceswap" && !sourceVideoFile) {
      return NextResponse.json({ error: "Source video is required for face swap" }, { status: 400 });
    }

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
      include: {
        character: {
          select: { id: true, name: true, description: true, referenceImages: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (project.status === "generating") {
      // Allow retry if the last job is stale (>10 min old, likely failed silently)
      const staleJob = await prisma.generationJob.findFirst({
        where: { projectId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, status: true },
      });
      const isStale = staleJob && (
        staleJob.status === "failed" ||
        Date.now() - new Date(staleJob.createdAt).getTime() > 10 * 60 * 1000
      );
      if (!isStale) {
        return NextResponse.json(
          { error: "Generation already in progress" },
          { status: 409 }
        );
      }
      // Reset project status so we can retry
      await prisma.project.update({
        where: { id: projectId },
        data: { status: "draft" },
      });
    }

    // Calculate credit cost
    const cost = duration === "10" ? CREDIT_COSTS.video10s : CREDIT_COSTS.video5s;
    const { total } = await getAvailableCredits(userId);

    if (total < cost) {
      return NextResponse.json(
        { error: "insufficient_credits", required: cost, available: total },
        { status: 403 }
      );
    }

    // Upload source files to R2 if provided
    let sourceVideoKey: string | undefined;
    let sourceImageKey: string | undefined;

    if (sourceVideoFile) {
      const bytes = new Uint8Array(await sourceVideoFile.arrayBuffer());
      sourceVideoKey = r2KeyForProjectSource(userId, projectId, "video");
      await uploadToR2(sourceVideoKey, Buffer.from(bytes), sourceVideoFile.type);
    }

    if (sourceImageFile) {
      const bytes = new Uint8Array(await sourceImageFile.arrayBuffer());
      sourceImageKey = r2KeyForProjectSource(userId, projectId, "image");
      await uploadToR2(sourceImageKey, Buffer.from(bytes), sourceImageFile.type);
    }

    // Enhance prompt via Claude Haiku (for text2video and image2video)
    let enhancedPrompt = prompt.trim();
    if (prompt.trim() && (mode === "text2video" || mode === "image2video")) {
      try {
        const characterContext = project.character
          ? `${project.character.name}: ${project.character.description ?? "AI character"}`
          : undefined;
        enhancedPrompt = await enhanceVideoPrompt(prompt.trim(), characterContext);
      } catch {
        // Fall back to raw prompt
      }
    }

    // Character reference image key
    const characterImageKey = project.character?.referenceImages[0] ?? undefined;

    // Update project with generation params
    await prisma.project.update({
      where: { id: projectId },
      data: {
        mode,
        prompt: prompt.trim() || null,
        enhancedPrompt: enhancedPrompt || null,
        sourceVideoUrl: sourceVideoKey ?? undefined,
        sourceImageUrl: sourceImageKey ?? undefined,
        duration,
        aspectRatio,
      },
    });

    // Create generation job record
    const job = await prisma.generationJob.create({
      data: {
        userId,
        type: mode,
        status: "queued",
        projectId,
        characterId: project.characterId,
      },
    });

    // Enqueue BullMQ job
    try {
      await getVideoQueue().add(
        `video-${projectId}`,
        {
          jobId: job.id,
          projectId,
          userId,
          mode: mode as "text2video" | "image2video" | "faceswap",
          prompt: prompt.trim(),
          enhancedPrompt,
          duration: duration as "5" | "10",
          aspectRatio: aspectRatio as "16:9" | "9:16" | "1:1",
          characterImageKey,
          sourceVideoKey,
          sourceImageKey,
        },
        { jobId: job.id }
      );
    } catch (err) {
      await prisma.generationJob.delete({ where: { id: job.id } });
      console.error("[generate] Failed to enqueue job:", err);
      return NextResponse.json(
        { error: "Service temporarily unavailable" },
        { status: 503 }
      );
    }

    // Debit credits (only after successful enqueue)
    await deductCredits(userId, cost, `Video generation: ${project.name}`, "video_debit");

    // Set project status to generating
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "generating" },
    });

    return NextResponse.json({
      jobId: job.id,
      status: "queued",
      enhancedPrompt,
    });
  } catch (err) {
    console.error("[generate] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
