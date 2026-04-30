/**
 * KIE.AI webhook handler.
 *
 * KIE.AI POSTs task completion callbacks to this endpoint.
 * We log the raw payload (to learn the exact field names) and, on success/fail,
 * finalize the generation in the database so the next status poll returns immediately.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { refundCredits } from "@/lib/credits";
import { uploadToR2, getSignedR2Url } from "@/lib/r2";
import { sanitizeClientError } from "@/lib/errors";

function r2KeyForGeneration(userId: string, generationId: string, ext: string) {
  return `users/${userId}/generations/${generationId}/output.${ext}`;
}

function r2KeyForThumbnail(generationId: string) {
  return `thumbnails/${generationId}.webp`;
}

async function persistMediaToR2(
  mediaUrl: string,
  userId: string,
  generationId: string,
  ext = "mp4"
): Promise<{ key: string; buffer: Buffer }> {
  const response = await fetch(mediaUrl);
  if (!response.ok) throw new Error(`Failed to download: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const key = r2KeyForGeneration(userId, generationId, ext);
  await uploadToR2(key, buffer, `video/${ext}`);
  return { key, buffer };
}

async function generateVideoThumbnail(videoBuffer: Buffer, generationId: string): Promise<string | null> {
  try {
    const { execFile } = await import("child_process");
    const sharp = (await import("sharp")).default;
    const frameBuffer = await new Promise<Buffer>((resolve, reject) => {
      const proc = execFile(
        "ffmpeg",
        ["-i", "pipe:0", "-vframes", "1", "-f", "image2pipe", "-vcodec", "png", "pipe:1"],
        { maxBuffer: 10 * 1024 * 1024, encoding: "buffer" as BufferEncoding },
        (err, stdout) => { if (err) reject(err); else resolve(Buffer.from(stdout as unknown as ArrayBuffer)); }
      );
      proc.stdin?.write(videoBuffer);
      proc.stdin?.end();
    });
    const thumbnailBuffer = await sharp(frameBuffer).resize({ width: 400, withoutEnlargement: true }).webp({ quality: 70 }).toBuffer();
    const thumbnailKey = r2KeyForThumbnail(generationId);
    await uploadToR2(thumbnailKey, thumbnailBuffer, "image/webp");
    return thumbnailKey;
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  // Log raw payload to capture actual field names from KIE.AI
  console.log(`[kieai-webhook] raw payload: ${JSON.stringify(body).slice(0, 800)}`);

  // Extract task info — KIE.AI may nest under data or send flat
  const taskData = (body?.data ?? body) as Record<string, unknown>;
  const taskId = (taskData?.taskId ?? taskData?.task_id) as string | undefined;
  // State field may be named "state", "status", or "taskStatus"
  const state = (taskData?.state ?? taskData?.status ?? taskData?.taskStatus) as string | undefined;

  console.log(`[kieai-webhook] taskId=${taskId ?? "(none)"} state=${state ?? "(none)"}`);

  if (!taskId || !state) {
    return NextResponse.json({ ok: true });
  }

  // Find the generation with this KIE.AI task ID
  let generation: {
    id: string;
    userId: string;
    status: string;
    creditsCost: number;
    durationSec: number | null;
    startedAt: Date | null;
    modelId: string | null;
  } | null = null;

  try {
    // inputParams is a JSON column — Prisma doesn't support JSON path queries in all DBs
    // so we fetch recent PROCESSING KIE.AI generations and match by taskId
    const candidates = await prisma.generation.findMany({
      where: {
        status: { in: ["QUEUED", "PROCESSING"] },
        provider: "PIAPI", // KIE.AI uses PIAPI provider in our schema
      },
      select: {
        id: true,
        userId: true,
        status: true,
        creditsCost: true,
        durationSec: true,
        startedAt: true,
        modelId: true,
        inputParams: true,
      },
      take: 100,
      orderBy: { queuedAt: "desc" },
    });

    for (const g of candidates) {
      const params = g.inputParams as Record<string, unknown>;
      if (params?.kieAiTaskId === taskId || params?.submissionPath === "kieai" && params?.kieAiTaskId === taskId) {
        generation = g;
        break;
      }
    }
  } catch (err) {
    console.error(`[kieai-webhook] DB lookup error:`, err);
    return NextResponse.json({ ok: true });
  }

  if (!generation) {
    console.warn(`[kieai-webhook] No generation found for taskId=${taskId}`);
    return NextResponse.json({ ok: true });
  }

  // Already finalized — idempotent
  if (generation.status === "COMPLETED" || generation.status === "FAILED") {
    return NextResponse.json({ ok: true });
  }

  if (state === "success") {
    // Extract video URL from callback payload
    let videoUrl: string | undefined;
    try {
      if (taskData?.resultJson) {
        const parsed = JSON.parse(taskData.resultJson as string) as { resultUrls?: string[] };
        videoUrl = parsed.resultUrls?.[0];
      }
      if (!videoUrl) {
        const direct = taskData?.resultUrls as string[] | undefined;
        if (Array.isArray(direct) && direct.length > 0) videoUrl = direct[0];
      }
    } catch {
      console.error(`[kieai-webhook] Failed to parse resultJson for task=${taskId}`);
    }

    if (!videoUrl) {
      console.error(`[kieai-webhook] success but no videoUrl found in payload`);
      await prisma.generation.update({
        where: { id: generation.id },
        data: { status: "FAILED", errorMessage: "Generation completed but no output received", completedAt: new Date() },
      });
      return NextResponse.json({ ok: true });
    }

    const completedAt = new Date();
    const generationTimeMs = generation.startedAt ? completedAt.getTime() - generation.startedAt.getTime() : null;

    let r2Key: string | null = null;
    let thumbnailKey: string | null = null;
    try {
      const result = await persistMediaToR2(videoUrl, generation.userId, generation.id, "mp4");
      r2Key = result.key;
      thumbnailKey = await generateVideoThumbnail(result.buffer, generation.id);
    } catch (err) {
      console.error(`[kieai-webhook] Failed to persist video to R2:`, err);
    }

    await prisma.generation.update({
      where: { id: generation.id },
      data: {
        status: "COMPLETED",
        progress: 100,
        outputUrl: r2Key ?? videoUrl,
        thumbnailUrl: thumbnailKey,
        durationSec: generation.durationSec ?? 5,
        completedAt,
        generationTimeMs,
      },
    });

    console.log(`[kieai-webhook] Completed gen=${generation.id} r2Key=${r2Key}`);
  } else if (state === "fail" || state === "failed") {
    const rawErr = (taskData?.failMsg ?? taskData?.errorMsg ?? taskData?.error ?? "Generation failed") as string;
    console.error(`[kieai-webhook] Failed gen=${generation.id} error="${rawErr}"`);

    await refundCredits(generation.userId, generation.creditsCost, `Refund: Generation failed (${generation.modelId})`);
    await prisma.generation.update({
      where: { id: generation.id },
      data: { status: "FAILED", errorMessage: sanitizeClientError(rawErr, "kieai-webhook"), completedAt: new Date() },
    });
  } else {
    // In-progress state — update status
    const progress = (taskData?.progress as number) ?? 10;
    const dbStatus = state === "generating" ? "PROCESSING" : "QUEUED";
    await prisma.generation.update({
      where: { id: generation.id },
      data: { progress, status: dbStatus },
    }).catch(() => {}); // non-fatal
  }

  return NextResponse.json({ ok: true });
}
