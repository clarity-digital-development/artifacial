import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  getTaskStatus,
  estimateApiCost,
} from "@/lib/piapi-client";
import { retrieveVeniceVideo, enrichNSFWPrompt } from "@/lib/venice";
import { getKieAiTaskStatus } from "@/lib/kieai";
import { isValidModelId, getModelById, getPiApiTaskType } from "@/lib/models/registry";
import { refundCredits } from "@/lib/credits";
import { uploadToR2, getSignedR2Url } from "@/lib/r2";
import { submitTask, buildVideoInput, buildImageInput } from "@/lib/piapi-client";

// ─── Helpers ───

function r2KeyForGeneration(userId: string, generationId: string, ext: string) {
  return `users/${userId}/generations/${generationId}/output.${ext}`;
}

function r2KeyForThumbnail(generationId: string) {
  return `thumbnails/${generationId}.webp`;
}

/**
 * Download media from a URL and upload it to R2.
 * Returns the R2 key and the downloaded buffer (for thumbnail generation).
 * External URLs expire, so we must persist to our own storage.
 */
async function persistMediaToR2(
  mediaUrl: string,
  userId: string,
  generationId: string,
  defaultExt: string = "mp4"
): Promise<{ key: string; buffer: Buffer; contentType: string }> {
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
  return { key, buffer, contentType };
}

/**
 * Generate a thumbnail from an image buffer using sharp.
 * Resizes to max 400px wide, quality 70, WebP format.
 * Returns the R2 key or null if thumbnail generation fails.
 */
async function generateImageThumbnail(
  imageBuffer: Buffer,
  generationId: string
): Promise<string | null> {
  try {
    const sharp = (await import("sharp")).default;
    const thumbnailBuffer = await sharp(imageBuffer)
      .resize({ width: 400, withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer();

    const thumbnailKey = r2KeyForThumbnail(generationId);
    await uploadToR2(thumbnailKey, thumbnailBuffer, "image/webp");
    console.log(`[status] Thumbnail generated: ${thumbnailKey} (${thumbnailBuffer.length} bytes)`);
    return thumbnailKey;
  } catch (err) {
    console.error(`[status] Thumbnail generation failed for gen=${generationId}:`, err);
    return null;
  }
}

/**
 * Extract first frame from a video buffer using ffmpeg, then resize with sharp.
 * ffmpeg reads from stdin and writes a PNG frame to stdout — no temp files.
 * Returns the R2 key or null if extraction fails.
 */
async function generateVideoThumbnail(
  videoBuffer: Buffer,
  generationId: string
): Promise<string | null> {
  try {
    const { execFile } = await import("child_process");
    const sharp = (await import("sharp")).default;

    // Extract first frame: ffmpeg reads from stdin, writes single PNG to stdout
    const frameBuffer = await new Promise<Buffer>((resolve, reject) => {
      const proc = execFile(
        "ffmpeg",
        [
          "-i", "pipe:0",        // read from stdin
          "-vframes", "1",       // one frame only
          "-f", "image2pipe",    // output as image pipe
          "-vcodec", "png",      // PNG format
          "pipe:1",              // write to stdout
        ],
        { maxBuffer: 10 * 1024 * 1024, encoding: "buffer" as BufferEncoding },
        (err, stdout) => {
          if (err) reject(err);
          else resolve(Buffer.from(stdout as unknown as ArrayBuffer));
        }
      );
      proc.stdin?.write(videoBuffer);
      proc.stdin?.end();
    });

    // Resize with sharp to 400px webp
    const thumbnailBuffer = await sharp(frameBuffer)
      .resize({ width: 400, withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer();

    const thumbnailKey = r2KeyForThumbnail(generationId);
    await uploadToR2(thumbnailKey, thumbnailBuffer, "image/webp");
    console.log(`[status] Video thumbnail generated: ${thumbnailKey} (${thumbnailBuffer.length} bytes)`);
    return thumbnailKey;
  } catch (err) {
    console.error(`[status] Video thumbnail generation failed for gen=${generationId}:`, err);
    return null;
  }
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
      contentMode: true,
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

    // Sign thumbnail URL if it's an R2 key
    let thumbnailUrl = generation.thumbnailUrl;
    if (thumbnailUrl && !thumbnailUrl.startsWith("http")) {
      try {
        thumbnailUrl = await getSignedR2Url(thumbnailUrl, 3600);
      } catch {
        thumbnailUrl = null;
      }
    }

    return NextResponse.json({
      id: generation.id,
      status: generation.status,
      progress: generation.status === "COMPLETED" ? 100 : generation.progress,
      outputUrl,
      thumbnailUrl,
      errorMessage: generation.errorMessage,
      queuedAt: generation.queuedAt,
      startedAt: generation.startedAt,
      completedAt: generation.completedAt,
      generationTimeMs: generation.generationTimeMs,
      parentGenerationId: generation.parentGenerationId,
    });
  }

  // ─── Determine provider and task IDs ───

  const inputParams = generation.inputParams as Record<string, unknown>;
  const piApiTaskId = inputParams?.piApiTaskId as string | undefined;
  const veniceQueueId = inputParams?.veniceQueueId as string | undefined;
  const veniceModel = inputParams?.veniceModel as string | undefined;
  const kieAiTaskId = inputParams?.kieAiTaskId as string | undefined;

  // Legacy fal.ai support: check for falRequestId for in-flight generations
  const falRequestId = inputParams?.falRequestId as string | undefined;

  if (!piApiTaskId && !veniceQueueId && !kieAiTaskId && !falRequestId) {
    return NextResponse.json({
      id: generation.id,
      status: generation.status,
      progress: generation.progress,
      errorMessage: "Missing task tracking ID",
    });
  }

  // Legacy fal.ai generations still in flight — return current DB status
  if (falRequestId && !piApiTaskId && !veniceQueueId) {
    return NextResponse.json({
      id: generation.id,
      status: generation.status,
      progress: generation.progress,
      errorMessage: "Legacy generation — waiting for completion",
      queuedAt: generation.queuedAt,
      startedAt: generation.startedAt,
    });
  }

  // ─── Venice AI polling ───

  if (veniceQueueId && veniceModel) {
    try {
      const veniceStatus = await retrieveVeniceVideo(veniceModel, veniceQueueId);
      console.log(`[status] gen=${generation.id} venice_queue=${veniceQueueId} status=${veniceStatus.status} error=${veniceStatus.errorMessage || "none"}`);

      if (veniceStatus.status === "completed") {
        if (!veniceStatus.videoBuffer) {
          await prisma.generation.update({
            where: { id: generation.id },
            data: {
              status: "FAILED",
              errorMessage: "Venice completed but no video data received",
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

        const durationSec = generation.durationSec ?? 5;

        // Venice returns binary video — upload directly to R2
        const contentType = veniceStatus.contentType || "video/mp4";
        const ext = contentType.includes("webm") ? "webm" : "mp4";
        const r2Key = r2KeyForGeneration(session.user.id, generation.id, ext);

        try {
          await uploadToR2(r2Key, veniceStatus.videoBuffer, contentType);
        } catch (r2Error) {
          console.error("Failed to upload Venice video to R2:", r2Error);
          // Fall through — we still mark as completed but without persistent storage
        }

        await prisma.generation.update({
          where: { id: generation.id },
          data: {
            status: "COMPLETED",
            progress: 100,
            outputUrl: r2Key,
            durationSec,
            completedAt,
            generationTimeMs,
          },
        });

        const signedUrl = await getSignedR2Url(r2Key, 3600);

        return NextResponse.json({
          id: generation.id,
          status: "COMPLETED",
          progress: 100,
          outputUrl: signedUrl,
          completedAt,
          generationTimeMs,
        });
      }

      if (veniceStatus.status === "failed") {
        console.error(`[status] VENICE FAILED gen=${generation.id} queue=${veniceQueueId} model=${veniceModel} error=${veniceStatus.errorMessage}`);
        if (generation.errorMessage !== "ACCOUNT_DELETED") {
          await refundCredits(
            session.user.id,
            generation.creditsCost,
            `Refund: Venice generation failed (${generation.modelId})`
          );
        }

        await prisma.generation.update({
          where: { id: generation.id },
          data: {
            status: "FAILED",
            errorMessage: veniceStatus.errorMessage || "Venice generation failed",
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

      // Still processing — estimate progress from execution time
      let progress = 50;
      if (veniceStatus.averageExecutionTime && veniceStatus.executionDuration) {
        progress = Math.min(
          95,
          Math.round((veniceStatus.executionDuration / veniceStatus.averageExecutionTime) * 100)
        );
      }

      if (generation.progress !== progress) {
        await prisma.generation.update({
          where: { id: generation.id },
          data: { progress, status: "PROCESSING" },
        });
      }

      return NextResponse.json({
        id: generation.id,
        status: "PROCESSING",
        progress,
        queuedAt: generation.queuedAt,
        startedAt: generation.startedAt,
      });
    } catch (error) {
      console.error("Venice status poll error:", error);
      return NextResponse.json({
        id: generation.id,
        status: generation.status,
        progress: generation.progress,
        errorMessage: "Failed to check Venice generation status",
      });
    }
  }

  // ─── KIE.AI polling (Kling 3.0 motion control) ───

  if (kieAiTaskId) {
    try {
      const kieStatus = await getKieAiTaskStatus(kieAiTaskId);
      const kieState = kieStatus.status;
      console.log(`[status] gen=${generation.id} kieai_task=${kieAiTaskId} state=${kieState} progress=${kieStatus.progress ?? "?"}`);

      if (kieState === "success") {
        if (!kieStatus.videoUrl) {
          await prisma.generation.update({
            where: { id: generation.id },
            data: { status: "FAILED", errorMessage: "KIE.AI succeeded but returned no video URL", completedAt: new Date() },
          });
          return NextResponse.json({ id: generation.id, status: "FAILED", progress: 0, errorMessage: "Generation completed but no output received." });
        }

        const completedAt = new Date();
        const generationTimeMs = generation.startedAt ? completedAt.getTime() - generation.startedAt.getTime() : null;
        const durationSec = generation.durationSec ?? 5;

        let r2Key: string | null = null;
        let thumbnailKey: string | null = null;
        try {
          const result = await persistMediaToR2(kieStatus.videoUrl, session.user.id, generation.id, "mp4");
          r2Key = result.key;
          if (result.contentType.startsWith("image/")) {
            thumbnailKey = await generateImageThumbnail(result.buffer, generation.id);
          } else {
            thumbnailKey = await generateVideoThumbnail(result.buffer, generation.id);
          }
        } catch (r2Error) {
          console.error("[status] Failed to persist KIE.AI output to R2:", r2Error);
        }

        await prisma.generation.update({
          where: { id: generation.id },
          data: {
            status: "COMPLETED",
            progress: 100,
            outputUrl: r2Key ?? kieStatus.videoUrl,
            thumbnailUrl: thumbnailKey,
            durationSec,
            completedAt,
            generationTimeMs,
          },
        });

        const signedUrl = r2Key ? await getSignedR2Url(r2Key, 3600) : kieStatus.videoUrl;
        let signedThumbnailUrl: string | null = thumbnailKey;
        if (thumbnailKey && !thumbnailKey.startsWith("http")) {
          try { signedThumbnailUrl = await getSignedR2Url(thumbnailKey, 3600); } catch { signedThumbnailUrl = null; }
        }

        return NextResponse.json({ id: generation.id, status: "COMPLETED", progress: 100, outputUrl: signedUrl, thumbnailUrl: signedThumbnailUrl, completedAt, generationTimeMs });
      }

      if (kieState === "fail") {
        const errorMsg = kieStatus.errorMessage || "KIE.AI generation failed";
        console.error(`[status] KIEAI FAILED gen=${generation.id} task=${kieAiTaskId} error="${errorMsg}"`);
        await refundCredits(session.user.id, generation.creditsCost, `Refund: KIE.AI generation failed (${generation.modelId})`);
        await prisma.generation.update({
          where: { id: generation.id },
          data: { status: "FAILED", errorMessage: errorMsg, completedAt: new Date() },
        });
        return NextResponse.json({ id: generation.id, status: "FAILED", progress: 0, errorMessage: "Generation failed. Credits have been refunded." });
      }

      // Still in progress (waiting / queuing / generating)
      const kieProgress = kieStatus.progress ?? (kieState === "generating" ? 50 : 10);
      const dbStatus = kieState === "generating" ? "PROCESSING" : "QUEUED";

      if (generation.progress !== kieProgress) {
        await prisma.generation.update({ where: { id: generation.id }, data: { progress: kieProgress, status: dbStatus } });
      }

      return NextResponse.json({ id: generation.id, status: dbStatus, progress: kieProgress, queuedAt: generation.queuedAt, startedAt: generation.startedAt });
    } catch (error) {
      console.error("[status] KIE.AI status poll error:", error);
      return NextResponse.json({ id: generation.id, status: generation.status, progress: generation.progress, errorMessage: "Failed to check KIE.AI generation status" });
    }
  }

  // ─── PiAPI polling (unified for all PiAPI models) ───

  try {
    const piStatus = await getTaskStatus(piApiTaskId!);
    console.log(`[status] gen=${generation.id} task=${piApiTaskId} status=${piStatus.status} progress=${piStatus.progress} error=${piStatus.errorMessage || "none"}`);

    if (piStatus.status === "completed") {
      const outputUrl = piStatus.videoUrl || piStatus.imageUrl;

      if (!outputUrl) {
        console.error(`[status] COMPLETED BUT NO OUTPUT gen=${generation.id} task=${piApiTaskId} raw=${JSON.stringify(piStatus.raw)}`);
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
      let thumbnailKey: string | null = null;
      try {
        const result = await persistMediaToR2(outputUrl, session.user.id, generation.id, defaultExt);
        r2Key = result.key;

        // Generate thumbnail — images via sharp, videos via ffmpeg first-frame extraction
        if (isImage) {
          thumbnailKey = await generateImageThumbnail(result.buffer, generation.id);
        } else {
          thumbnailKey = await generateVideoThumbnail(result.buffer, generation.id);
        }
      } catch (r2Error) {
        console.error("Failed to persist output to R2:", r2Error);
      }

      // Fallback: persist PiAPI's thumbnail URL to R2 if ffmpeg extraction failed
      if (!thumbnailKey && piStatus.thumbnailUrl) {
        try {
          const thumbResp = await fetch(piStatus.thumbnailUrl);
          if (thumbResp.ok) {
            const thumbBuffer = Buffer.from(await thumbResp.arrayBuffer());
            const thumbKey = r2KeyForThumbnail(generation.id);
            await uploadToR2(thumbKey, thumbBuffer, "image/webp");
            thumbnailKey = thumbKey;
            console.log(`[status] Video thumbnail persisted from PiAPI: ${thumbKey}`);
          }
        } catch (thumbErr) {
          console.error(`[status] Failed to persist PiAPI thumbnail:`, thumbErr);
        }
      }

      const finalThumbnailKey = thumbnailKey || null;

      await prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: "COMPLETED",
          progress: 100,
          outputUrl: r2Key ?? outputUrl,
          thumbnailUrl: finalThumbnailKey,
          durationSec,
          completedAt,
          generationTimeMs,
        },
      });

      const signedUrl = r2Key
        ? await getSignedR2Url(r2Key, 3600)
        : outputUrl;

      // Sign thumbnail URL if it's an R2 key
      let signedThumbnailUrl = finalThumbnailKey;
      if (finalThumbnailKey && !finalThumbnailKey.startsWith("http")) {
        try {
          signedThumbnailUrl = await getSignedR2Url(finalThumbnailKey, 3600);
        } catch {
          signedThumbnailUrl = null;
        }
      }

      return NextResponse.json({
        id: generation.id,
        status: "COMPLETED",
        progress: 100,
        outputUrl: signedUrl,
        thumbnailUrl: signedThumbnailUrl,
        completedAt,
        generationTimeMs,
      });
    }

    if (piStatus.status === "failed") {
      const errorMsg = piStatus.errorMessage || "Generation failed";
      const raw = piStatus.raw as Record<string, unknown> || {};
      const rawLogs = JSON.stringify(raw);
      const logs = Array.isArray(raw.logs) ? raw.logs.join(" | ") : "";
      const errorCode = (raw.error as Record<string, unknown>)?.code;
      const rawMessage = (raw.error as Record<string, unknown>)?.raw_message || "";
      const meta = raw.meta as Record<string, unknown> || {};
      const startedAt = meta.started_at as string;
      const endedAt = meta.ended_at as string;
      const usage = meta.usage as Record<string, unknown> || {};

      // Classify the failure type
      const isModerationBlock = rawLogs.includes("inappropriate content") || rawLogs.includes("content moderation");
      const isInferenceFailure = logs.includes("video generation failed") || logs.includes("image generation failed");
      const isSubmitFailure = logs.includes("failed to submit");
      const isTimeout = rawLogs.includes("timeout") || rawLogs.includes("timed out");

      const failureType = isModerationBlock ? "MODERATION"
        : isSubmitFailure ? "SUBMIT_REJECTED"
        : isInferenceFailure ? "INFERENCE_FAILURE"
        : isTimeout ? "TIMEOUT"
        : "UNKNOWN";

      const durationMs = startedAt && endedAt
        ? new Date(endedAt).getTime() - new Date(startedAt).getTime()
        : null;

      console.error(`[status] FAILED gen=${generation.id} task=${piApiTaskId} model=${generation.modelId} type=${failureType} error="${errorMsg}" errorCode=${errorCode} rawMessage="${rawMessage}" logs="${logs}" durationMs=${durationMs} usage=${JSON.stringify(usage)} contentMode=${generation.contentMode}`);
      const submissionPath = inputParams?.submissionPath as string | undefined;
      const alreadyRetried = submissionPath === "piapi-retry-abstract";

      // Retry on moderation blocks OR inference failures for NSFW (DashScope may
      // catch content at inference time via a secondary classifier)
      const shouldRetryNSFW = isModerationBlock || isInferenceFailure;
      if (generation.contentMode === "NSFW" && shouldRetryNSFW && !alreadyRetried) {
        console.warn(`[status] NSFW moderation block detected, retrying with abstract enrichment gen=${generation.id}`);
        try {
          const originalPrompt = inputParams?.prompt as string;
          const model = getModelById(generation.modelId!);
          if (originalPrompt && model && model.pipiConfig) {
            const abstractPrompt = await enrichNSFWPrompt(originalPrompt, "video", true);
            const piApiModel = model.pipiConfig.model;
            const taskType = getPiApiTaskType(generation.modelId!, "T2V");

            if (taskType) {
              const retryInput = buildVideoInput(piApiModel, taskType, {
                prompt: abstractPrompt,
                imageUrl: (inputParams?.imageUrl as string) || null,
                endImageUrl: (inputParams?.endImageUrl as string) || null,
                videoUrl: (inputParams?.videoUrl as string) || null,
                durationSec: generation.durationSec ?? 5,
                aspectRatio: (inputParams?.aspectRatio as string) || "16:9",
                resolution: (inputParams?.resolution as string) || "720p",
                withAudio: generation.withAudio ?? false,
              });

              if (model.pipiConfig.defaults) {
                Object.assign(retryInput, model.pipiConfig.defaults);
              }

              const retryResult = await submitTask(piApiModel, taskType, retryInput);

              await prisma.generation.update({
                where: { id: generation.id },
                data: {
                  status: "PROCESSING",
                  startedAt: new Date(),
                  promptId: retryResult.taskId,
                  errorMessage: null,
                  inputParams: {
                    ...inputParams,
                    enrichedPrompt: abstractPrompt,
                    piApiTaskId: retryResult.taskId,
                    submissionPath: "piapi-retry-abstract",
                  },
                },
              });

              console.log(`[status] NSFW abstract retry submitted: gen=${generation.id} newTask=${retryResult.taskId}`);
              return NextResponse.json({
                id: generation.id,
                status: "PROCESSING",
                progress: 10,
                queuedAt: generation.queuedAt,
                startedAt: new Date(),
              });
            }
          }
        } catch (retryError) {
          console.error(`[status] NSFW abstract retry failed:`, retryError instanceof Error ? retryError.message : retryError);
          // Fall through to normal failure handling
        }
      }

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
          errorMessage: errorMsg,
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
