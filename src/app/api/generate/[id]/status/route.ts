import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getTaskStatus,
  estimateApiCost,
} from "@/lib/piapi-client";
import { isValidModelId } from "@/lib/models/registry";
import { refundCredits } from "@/lib/credits";
import { uploadToR2, getSignedR2Url } from "@/lib/r2";

// ─── Helpers ───

function r2KeyForGeneration(userId: string, generationId: string, ext: string) {
  return `users/${userId}/generations/${generationId}/output.${ext}`;
}

/**
 * Download media from a URL and upload it to R2.
 * Returns the R2 key. External URLs expire, so we must persist to our own storage.
 */
async function persistMediaToR2(
  mediaUrl: string,
  userId: string,
  generationId: string,
  defaultExt: string = "mp4"
): Promise<string> {
  const response = await fetch(mediaUrl);
  if (!response.ok) {
    throw new Error(`Failed to download media: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || `video/${defaultExt}`;
  let ext = defaultExt;
  if (contentType.includes("webm")) ext = "webm";
  else if (contentType.includes("webp")) ext = "webp";
  else if (contentType.includes("png")) ext = "png";
  else if (contentType.includes("jpeg") || contentType.includes("jpg")) ext = "jpg";

  const buffer = Buffer.from(await response.arrayBuffer());
  const key = r2KeyForGeneration(userId, generationId, ext);

  await uploadToR2(key, buffer, contentType);
  return key;
}

// ─── Route Handler ───

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const generation = await prisma.generation.findFirst({
    where: { id, userId: session.user.id },
    select: {
      id: true,
      status: true,
      provider: true,
      modelId: true,
      withAudio: true,
      outputUrl: true,
      thumbnailUrl: true,
      errorMessage: true,
      progress: true,
      durationSec: true,
      queuedAt: true,
      startedAt: true,
      completedAt: true,
      generationTimeMs: true,
      inputParams: true,
      creditsCost: true,
      parentGenerationId: true,
    },
  });

  if (!generation) {
    return NextResponse.json({ error: "Generation not found" }, { status: 404 });
  }

  // If already completed or failed, return cached status with signed R2 URL
  if (generation.status === "COMPLETED" || generation.status === "FAILED" || generation.status === "BLOCKED") {
    let outputUrl = generation.outputUrl;

    // Generate a fresh signed URL if we have an R2 key stored
    if (outputUrl && !outputUrl.startsWith("http")) {
      outputUrl = await getSignedR2Url(outputUrl, 3600);
    }

    return NextResponse.json({
      id: generation.id,
      status: generation.status,
      progress: generation.status === "COMPLETED" ? 100 : generation.progress,
      outputUrl,
      thumbnailUrl: generation.thumbnailUrl,
      errorMessage: generation.errorMessage,
      queuedAt: generation.queuedAt,
      startedAt: generation.startedAt,
      completedAt: generation.completedAt,
      generationTimeMs: generation.generationTimeMs,
      parentGenerationId: generation.parentGenerationId,
    });
  }

  // ─── PiAPI polling (unified for all models) ───

  const inputParams = generation.inputParams as Record<string, unknown>;
  const piApiTaskId = inputParams?.piApiTaskId as string | undefined;

  // Legacy fal.ai support: check for falRequestId for in-flight generations
  const falRequestId = inputParams?.falRequestId as string | undefined;

  if (!piApiTaskId && !falRequestId) {
    return NextResponse.json({
      id: generation.id,
      status: generation.status,
      progress: generation.progress,
      errorMessage: "Missing task tracking ID",
    });
  }

  // Legacy fal.ai generations still in flight — return current DB status
  // These will eventually complete or timeout on their own
  if (falRequestId && !piApiTaskId) {
    return NextResponse.json({
      id: generation.id,
      status: generation.status,
      progress: generation.progress,
      errorMessage: "Legacy generation — waiting for completion",
      queuedAt: generation.queuedAt,
      startedAt: generation.startedAt,
    });
  }

  try {
    const piStatus = await getTaskStatus(piApiTaskId!);

    if (piStatus.status === "completed") {
      const outputUrl = piStatus.videoUrl || piStatus.imageUrl;

      if (!outputUrl) {
        // Task completed but no output — treat as failure
        await prisma.generation.update({
          where: { id: generation.id },
          data: {
            status: "FAILED",
            errorMessage: "Generation completed but no output received",
            completedAt: new Date(),
          },
        });
        return NextResponse.json({
          id: generation.id,
          status: "FAILED",
          progress: 0,
          errorMessage: "Generation completed but no output received.",
        });
      }

      const completedAt = new Date();
      const generationTimeMs = generation.startedAt
        ? completedAt.getTime() - generation.startedAt.getTime()
        : null;

      const durationSec = piStatus.durationSec ?? generation.durationSec ?? 5;

      // Download output and persist to R2 (external URLs expire)
      const isImage = !piStatus.videoUrl && !!piStatus.imageUrl;
      const defaultExt = isImage ? "webp" : "mp4";
      let r2Key: string | null = null;
      try {
        r2Key = await persistMediaToR2(outputUrl, session.user.id, generation.id, defaultExt);
      } catch (r2Error) {
        console.error("Failed to persist output to R2:", r2Error);
      }

      await prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: "COMPLETED",
          progress: 100,
          outputUrl: r2Key ?? outputUrl,
          thumbnailUrl: piStatus.thumbnailUrl || null,
          durationSec,
          completedAt,
          generationTimeMs,
        },
      });

      const signedUrl = r2Key
        ? await getSignedR2Url(r2Key, 3600)
        : outputUrl;

      return NextResponse.json({
        id: generation.id,
        status: "COMPLETED",
        progress: 100,
        outputUrl: signedUrl,
        thumbnailUrl: piStatus.thumbnailUrl,
        completedAt,
        generationTimeMs,
      });
    }

    if (piStatus.status === "failed") {
      // Refund credits on failure
      if (generation.errorMessage !== "ACCOUNT_DELETED") {
        await refundCredits(
          session.user.id,
          generation.creditsCost,
          `Refund: PiAPI generation failed (${generation.modelId})`
        );
      }

      await prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: "FAILED",
          errorMessage: piStatus.errorMessage || "Generation failed",
          completedAt: new Date(),
        },
      });

      return NextResponse.json({
        id: generation.id,
        status: "FAILED",
        progress: 0,
        errorMessage: "Generation failed. Credits have been refunded.",
      });
    }

    // Still in progress — update progress
    const progress = piStatus.progress ?? (piStatus.status === "processing" ? 50 : 10);
    const dbStatus = piStatus.status === "processing" ? "PROCESSING" : "QUEUED";

    if (generation.progress !== progress) {
      await prisma.generation.update({
        where: { id: generation.id },
        data: { progress, status: dbStatus },
      });
    }

    return NextResponse.json({
      id: generation.id,
      status: dbStatus,
      progress,
      queuedAt: generation.queuedAt,
      startedAt: generation.startedAt,
    });
  } catch (error) {
    console.error("PiAPI status poll error:", error);
    return NextResponse.json({
      id: generation.id,
      status: generation.status,
      progress: generation.progress,
      errorMessage: "Failed to check generation status",
    });
  }
}
