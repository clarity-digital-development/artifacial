import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { enhanceVideoPrompt } from "@/lib/anthropic";
import { getVideoQueue } from "@/lib/queue";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { id: projectId } = await params;

  // Parse request
  const { prompt } = (await req.json()) as { prompt?: string };
  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
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
    return NextResponse.json(
      { error: "Generation already in progress" },
      { status: 409 }
    );
  }

  // Check video credits
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { videoCredits: true },
  });

  if (!user || user.videoCredits < 1) {
    return NextResponse.json(
      {
        error: "insufficient_credits",
        type: "video",
        required: 1,
        available: user?.videoCredits ?? 0,
      },
      { status: 403 }
    );
  }

  // Enhance prompt via Claude Haiku
  let enhancedPrompt: string;
  try {
    const characterContext = project.character
      ? `${project.character.name}: ${project.character.description ?? "AI character"}`
      : undefined;
    enhancedPrompt = await enhanceVideoPrompt(prompt.trim(), characterContext);
  } catch {
    // Fall back to raw prompt if enhancement fails
    enhancedPrompt = prompt.trim();
  }

  // Store character R2 key (worker will sign a fresh URL before calling Kling)
  const characterImageKey = project.character?.referenceImages[0] ?? undefined;

  // Save prompt on project
  await prisma.project.update({
    where: { id: projectId },
    data: {
      prompt: prompt.trim(),
      enhancedPrompt,
    },
  });

  // Create generation job record
  const job = await prisma.generationJob.create({
    data: {
      userId,
      type: "video",
      status: "queued",
      projectId,
      characterId: project.characterId,
    },
  });

  // Enqueue BullMQ job — do this BEFORE debiting credits
  // so if Redis is down, the user doesn't lose a credit
  try {
    await getVideoQueue().add(
      `video-${projectId}`,
      {
        jobId: job.id,
        projectId,
        userId,
        prompt: prompt.trim(),
        enhancedPrompt,
        characterImageKey,
      },
      { jobId: job.id }
    );
  } catch (err) {
    // Clean up the job record if queue fails
    await prisma.generationJob.delete({ where: { id: job.id } });
    console.error("[generate] Failed to enqueue job:", err);
    return NextResponse.json(
      { error: "Service temporarily unavailable" },
      { status: 503 }
    );
  }

  // Debit 1 video credit (only after successful enqueue)
  await prisma.user.update({
    where: { id: userId },
    data: { videoCredits: { decrement: 1 } },
  });
  await prisma.creditTransaction.create({
    data: {
      userId,
      type: "video_debit",
      videoCredits: -1,
      description: `Video generation: ${project.name}`,
    },
  });

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
}
