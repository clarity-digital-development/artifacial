import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  pollStatus as falPollStatus,
  getResult as falGetResult,
  estimateApiCost,
} from "@/lib/generation/fal-client";
import { isValidModelId } from "@/lib/models/registry";
import { refundCredits } from "@/lib/credits";
import { uploadToR2, getSignedR2Url } from "@/lib/r2";

// ─── Helpers ───

function r2KeyForGeneration(userId: string, generationId: string, ext: string) {
  return `users/${userId}/generations/${generationId}/output.${ext}`;
}

/**
 * Download a video from a URL and upload it to R2.
 * Returns the R2 key. fal.ai URLs expire, so we must persist to our own storage.
 */
async function persistVideoToR2(
  videoUrl: string,
  userId: string,
  generationId: string
): Promise<string> {
  const response = await fetch(videoUrl);
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "video/mp4";
  const ext = contentType.includes("webm") ? "webm" : "mp4";
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

  // For fal.ai generations, poll the upstream status
  if (generation.provider === "FAL_AI") {
    const inputParams = generation.inputParams as Record<string, unknown>;
    const falRequestId = inputParams?.falRequestId as string | undefined;
    const falEndpoint = inputParams?.falEndpoint as string | undefined;
    const modelId = generation.modelId;

    if (!falRequestId || !falEndpoint || !modelId || !isValidModelId(modelId)) {
      return NextResponse.json({
        id: generation.id,
        status: generation.status,
        progress: generation.progress,
        errorMessage: "Missing fal.ai tracking data",
      });
    }

    try {
      const falStatus = await falPollStatus(falEndpoint, falRequestId);

      if (falStatus.status === "COMPLETED") {
        // Fetch the actual result from fal.ai
        const result = await falGetResult(falEndpoint, falRequestId);

        const completedAt = new Date();
        const generationTimeMs = generation.startedAt
          ? completedAt.getTime() - generation.startedAt.getTime()
          : null;

        // Calculate actual API cost for margin tracking (audio rate if enabled)
        const durationSec = result.durationSec ?? generation.durationSec ?? 5;
        const apiCost = estimateApiCost(modelId, durationSec);

        // Download video from fal.ai and persist to R2 (fal.ai URLs expire)
        let r2Key: string | null = null;
        try {
          r2Key = await persistVideoToR2(result.videoUrl, session.user.id, generation.id);
        } catch (r2Error) {
          console.error("Failed to persist video to R2:", r2Error);
          // Fall back to fal.ai URL — better than losing the generation
          // but it WILL expire, so log this as a critical issue
        }

        // Update DB with R2 key (or fal.ai URL as fallback)
        await prisma.generation.update({
          where: { id: generation.id },
          data: {
            status: "COMPLETED",
            progress: 100,
            outputUrl: r2Key ?? result.videoUrl,
            thumbnailUrl: result.thumbnailUrl || null,
            apiCost,
            durationSec,
            completedAt,
            generationTimeMs,
          },
        });

        // Return a signed URL for the client
        const signedUrl = r2Key
          ? await getSignedR2Url(r2Key, 3600)
          : result.videoUrl;

        return NextResponse.json({
          id: generation.id,
          status: "COMPLETED",
          progress: 100,
          outputUrl: signedUrl,
          thumbnailUrl: result.thumbnailUrl,
          completedAt,
          generationTimeMs,
        });
      }

      if (falStatus.status === "FAILED") {
        // Refund credits on failure (skip if account deleted — credits already zeroed)
        if (generation.errorMessage !== "ACCOUNT_DELETED") {
          await refundCredits(
            session.user.id,
            generation.creditsCost,
            `Refund: fal.ai generation failed (${generation.modelId})`
          );
        }

        await prisma.generation.update({
          where: { id: generation.id },
          data: {
            status: "FAILED",
            errorMessage: "Generation failed on fal.ai",
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
      const progress = falStatus.status === "IN_PROGRESS" ? 50 : 10;
      const dbStatus = falStatus.status === "IN_PROGRESS" ? "PROCESSING" : "QUEUED";

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
      console.error("fal.ai status poll error:", error);
      return NextResponse.json({
        id: generation.id,
        status: generation.status,
        progress: generation.progress,
        errorMessage: "Failed to check generation status",
      });
    }
  }

  // For self-hosted jobs, return DB status (worker updates this directly)
  let selfHostedOutputUrl = generation.outputUrl;
  if (selfHostedOutputUrl && !selfHostedOutputUrl.startsWith("http")) {
    selfHostedOutputUrl = await getSignedR2Url(selfHostedOutputUrl, 3600);
  }

  return NextResponse.json({
    id: generation.id,
    status: generation.status,
    progress: generation.progress,
    outputUrl: selfHostedOutputUrl,
    thumbnailUrl: generation.thumbnailUrl,
    errorMessage: generation.errorMessage,
    queuedAt: generation.queuedAt,
    startedAt: generation.startedAt,
    completedAt: generation.completedAt,
    generationTimeMs: generation.generationTimeMs,
    parentGenerationId: generation.parentGenerationId,
  });
}
