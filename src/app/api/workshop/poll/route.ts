import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTaskStatus } from "@/lib/piapi-client";
import { getKieAiTaskStatus } from "@/lib/kieai";
import { retrieveVeniceVideo } from "@/lib/venice";
import { uploadToR2 } from "@/lib/r2";
import { sanitizeClientError } from "@/lib/errors";
import { prisma } from "@/lib/db";
import { getSignedR2Url } from "@/lib/r2";
import {
  persistMediaToR2,
  generateImageThumbnail,
  generateVideoThumbnail,
} from "@/lib/generation/persist";

/**
 * GET /api/workshop/poll?taskId=xxx&generationId=yyy
 *
 * Polls the upstream provider for status. If generationId is provided AND the
 * task is now COMPLETED, persists the output media to R2 and updates the
 * Generation DB row so the result shows up in /gallery and recent generations.
 *
 * generationId is optional for backwards compatibility — older clients without
 * it still get the same lightweight proxy behavior.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const taskId = req.nextUrl.searchParams.get("taskId");
  const generationId = req.nextUrl.searchParams.get("generationId");
  if (!taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  try {
    // ── Venice video routing (prefix: "venice:video:<model>:<queueId>") ──
    if (taskId.startsWith("venice:video:")) {
      const rest = taskId.slice("venice:video:".length);
      const sepIdx = rest.indexOf(":");
      if (sepIdx < 0) {
        return NextResponse.json({ error: "Malformed Venice task id" }, { status: 400 });
      }
      const veniceModel = rest.slice(0, sepIdx);
      const queueId = rest.slice(sepIdx + 1);

      const veniceResult = await retrieveVeniceVideo(veniceModel, queueId);

      let vStatus: "pending" | "processing" | "completed" | "failed";
      if (veniceResult.status === "completed") vStatus = "completed";
      else if (veniceResult.status === "failed") vStatus = "failed";
      else vStatus = "processing";

      let videoUrl: string | null = null;
      let errorMessage: string | null = null;

      // On completion: persist the returned MP4 buffer to R2 directly.
      if (vStatus === "completed" && veniceResult.videoBuffer && generationId) {
        const key = `users/${userId}/generations/${generationId}/output.mp4`;
        await uploadToR2(key, veniceResult.videoBuffer, "video/mp4");
        const signedVideoUrl = await getSignedR2Url(key, 3600);
        videoUrl = signedVideoUrl;

        // Best-effort thumbnail from the MP4 buffer. generateVideoThumbnail
        // uploads + returns the R2 key directly.
        let thumbnailKey: string | null = null;
        try {
          thumbnailKey = await generateVideoThumbnail(veniceResult.videoBuffer, generationId);
        } catch (e) {
          console.warn("[workshop-poll:venice] thumbnail extraction failed:", e instanceof Error ? e.message : e);
        }

        await prisma.generation.update({
          where: { id: generationId },
          data: {
            status: "COMPLETED",
            progress: 100,
            outputUrl: key,
            ...(thumbnailKey ? { thumbnailUrl: thumbnailKey } : {}),
            completedAt: new Date(),
          },
        }).catch(() => {});
      } else if (vStatus === "failed") {
        errorMessage = sanitizeClientError(veniceResult.errorMessage ?? "Generation failed", "workshop-poll:venice");
        if (generationId) {
          await prisma.generation.update({
            where: { id: generationId },
            data: { status: "FAILED", errorMessage, completedAt: new Date() },
          }).catch(() => {});
        }
      }

      return NextResponse.json({
        status: vStatus,
        errorMessage,
        videoUrl,
        imageUrl: null,
        imageUrls: null,
        audioUrl: null,
        audioUrls: null,
        text: null,
        modelUrl: null,
        songId: null,
      });
    }

    // ── KIE.AI task routing (prefix: "kieai:image:" or "kieai:video:") ──
    if (taskId.startsWith("kieai:image:") || taskId.startsWith("kieai:video:")) {
      const isImage = taskId.startsWith("kieai:image:");
      const realTaskId = taskId.replace(/^kieai:(image|video):/, "");

      const kieResult = await getKieAiTaskStatus(realTaskId);

      let kieStatus: "pending" | "processing" | "completed" | "failed";
      if (kieResult.status === "success") kieStatus = "completed";
      else if (kieResult.status === "fail") kieStatus = "failed";
      else if (kieResult.status === "generating") kieStatus = "processing";
      else kieStatus = "pending";

      const resultUrls = kieResult.resultUrls ?? (kieResult.videoUrl ? [kieResult.videoUrl] : []);
      const videoUrl = !isImage && resultUrls.length > 0 ? resultUrls[0] : null;
      const imageUrl = isImage && resultUrls.length > 0 ? resultUrls[0] : null;
      const errorMessage = kieStatus === "failed"
        ? sanitizeClientError(kieResult.errorMessage, "workshop-poll:kieai")
        : null;

      // Persist + update DB when finished
      if (generationId) {
        if (kieStatus === "completed" && (videoUrl || imageUrl)) {
          await finalizeGeneration({
            userId, generationId,
            mediaUrl: (videoUrl || imageUrl)!,
            isVideo: !!videoUrl,
          });
        } else if (kieStatus === "failed") {
          await markFailed(generationId, errorMessage);
        }
      }

      return NextResponse.json({
        status: kieStatus,
        errorMessage,
        videoUrl,
        imageUrl,
        imageUrls: isImage && resultUrls.length > 0 ? resultUrls : null,
        audioUrl: null,
        audioUrls: null,
        text: null,
        modelUrl: null,
        songId: null,
      });
    }

    // ── PiAPI generic ──
    const result = await getTaskStatus(taskId);
    const raw = (result.raw ?? {}) as Record<string, unknown>;
    const output = (
      raw.output ??
      (raw.task_result as Record<string, unknown> | undefined)?.task_output ??
      {}
    ) as Record<string, unknown>;

    let audioUrl: string | undefined;
    let audioUrls: string[] | undefined;
    let text: string | undefined;
    let modelUrl: string | undefined;
    let songId: string | undefined;

    if (result.status === "completed") {
      audioUrl =
        (output.audio_url as string) ||
        (typeof output.audio === "string" ? output.audio : undefined) ||
        (output.music_url as string) ||
        (output.song_url as string);

      const songsRaw = output.songs ?? output.song_list;
      if (Array.isArray(songsRaw) && songsRaw.length > 0) {
        const first = songsRaw[0] as Record<string, unknown>;
        songId = (first.id ?? first.song_id) as string | undefined;
        if (!audioUrl) {
          audioUrl = (first.audio_url ?? first.url ?? first.audio) as string | undefined;
        }
      }
      if (!songId) {
        songId = (output.song_id ?? output.id) as string | undefined;
      }

      const audiosRaw = output.audios ?? output.audio_urls ?? output.sounds ?? output.audio_list;
      if (Array.isArray(audiosRaw) && audiosRaw.length > 0) {
        audioUrls = (audiosRaw as unknown[])
          .map((a) =>
            typeof a === "string"
              ? a
              : ((a as Record<string, unknown>)?.url as string) ??
                ((a as Record<string, unknown>)?.audio_url as string)
          )
          .filter(Boolean) as string[];
      }

      text =
        (output.text as string) ||
        (output.caption as string) ||
        (output.description as string) ||
        (output.content as string);

      modelUrl =
        (output.model_url as string) ||
        (output.glb_url as string) ||
        (output.mesh_url as string) ||
        (output.output_url as string) ||
        ((output.outputs as Record<string, unknown> | undefined)?.model_url as string);
    }

    const errorMessage = result.status === "failed"
      ? sanitizeClientError(result.errorMessage, "workshop-poll:piapi")
      : null;

    // Persist + update DB when finished
    if (generationId) {
      if (result.status === "completed") {
        const primaryUrl =
          result.videoUrl || result.imageUrl ||
          (result.imageUrls?.[0]) || audioUrl || modelUrl;
        const isVideo = !!result.videoUrl;
        if (primaryUrl) {
          await finalizeGeneration({
            userId, generationId, mediaUrl: primaryUrl, isVideo,
            // Text-only outputs (JoyCaption) have no media URL — store the text instead
            textOutput: text,
          });
        } else if (text) {
          // Pure text output — no R2 persistence, just mark complete
          await prisma.generation.update({
            where: { id: generationId },
            data: {
              status: "COMPLETED",
              progress: 100,
              outputUrl: null,
              completedAt: new Date(),
              inputParams: {
                ...(await readInputParams(generationId)),
                textOutput: text,
              },
            },
          });
        }
      } else if (result.status === "failed") {
        await markFailed(generationId, errorMessage);
      }
    }

    return NextResponse.json({
      status: result.status,
      errorMessage,
      videoUrl: result.videoUrl ?? null,
      imageUrl: result.imageUrl ?? null,
      imageUrls: result.imageUrls ?? null,
      audioUrl: audioUrl ?? null,
      audioUrls: audioUrls ?? null,
      text: text ?? null,
      modelUrl: modelUrl ?? null,
      songId: songId ?? null,
    });
  } catch (err) {
    console.error("[workshop/poll] error:", err);
    return NextResponse.json(
      { error: "Failed to check task status" },
      { status: 500 }
    );
  }
}

// ─── DB persistence helpers ───────────────────────────────────────────────────

async function readInputParams(generationId: string): Promise<Record<string, unknown>> {
  const row = await prisma.generation.findUnique({
    where: { id: generationId },
    select: { inputParams: true },
  });
  return (row?.inputParams as Record<string, unknown>) ?? {};
}

async function finalizeGeneration(opts: {
  userId: string;
  generationId: string;
  mediaUrl: string;
  isVideo: boolean;
  textOutput?: string;
}): Promise<void> {
  const { userId, generationId, mediaUrl, isVideo, textOutput } = opts;

  // Skip if already finalized (poll may run multiple times)
  const existing = await prisma.generation.findUnique({
    where: { id: generationId },
    select: { status: true, userId: true },
  });
  if (!existing || existing.userId !== userId) return;
  if (existing.status === "COMPLETED" || existing.status === "FAILED") return;

  let r2Key: string | null = null;
  let thumbnailKey: string | null = null;

  try {
    const result = await persistMediaToR2(
      mediaUrl,
      userId,
      generationId,
      isVideo ? "mp4" : "png",
    );
    r2Key = result.key;

    if (isVideo) {
      thumbnailKey = await generateVideoThumbnail(result.buffer, generationId);
    } else if (result.contentType.startsWith("image/")) {
      thumbnailKey = await generateImageThumbnail(result.buffer, generationId);
    }
  } catch (r2Err) {
    console.error(`[workshop/poll] R2 persist failed gen=${generationId}:`, r2Err);
    // Fall through — we'll save the original URL on the row, output still viewable
  }

  await prisma.generation.update({
    where: { id: generationId },
    data: {
      status: "COMPLETED",
      progress: 100,
      outputUrl: r2Key ?? mediaUrl,
      thumbnailUrl: thumbnailKey,
      completedAt: new Date(),
      ...(textOutput
        ? {
            inputParams: {
              ...(await readInputParams(generationId)),
              textOutput,
            },
          }
        : {}),
    },
  });

  console.log(`[workshop/poll] FINALIZED gen=${generationId} r2Key=${r2Key} thumb=${thumbnailKey}`);
}

async function markFailed(generationId: string, errorMessage: string | null): Promise<void> {
  const existing = await prisma.generation.findUnique({
    where: { id: generationId },
    select: { status: true },
  });
  if (!existing || existing.status === "FAILED" || existing.status === "COMPLETED") return;

  await prisma.generation.update({
    where: { id: generationId },
    data: {
      status: "FAILED",
      errorMessage: errorMessage ?? "Generation failed",
      completedAt: new Date(),
    },
  });
}
