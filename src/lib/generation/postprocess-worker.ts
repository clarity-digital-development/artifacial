/**
 * ComfyUI Post-Processing Worker
 *
 * TypeScript process that BRPOP's from the postprocess-queue Redis list,
 * loads ComfyUI workflow templates, injects params, submits to ComfyUI,
 * monitors progress via WebSocket, downloads output, uploads to R2,
 * and updates Postgres.
 *
 * Memory management strategy (from research):
 * - POST /free after every job (clears VRAM + model cache)
 * - Monitor /system_stats — force restart if VRAM < 5 GB or RAM free < 20%
 * - Hard restart every 20 jobs (glibc malloc arena fragmentation)
 * - Per-workflow timeouts: face swap 5m, upscale 15m, lip sync 10m
 * - Group sequential jobs by type for model cache hits (20-40% faster)
 *
 * Run with: npx tsx src/lib/generation/postprocess-worker.ts
 */

import { randomUUID } from "crypto";
import Redis from "ioredis";
import { prisma } from "@/lib/db";
import { refundCredits } from "@/lib/credits";
import { uploadToR2, getSignedR2Url } from "@/lib/r2";
import {
  loadTemplate,
  injectParams,
  queuePrompt,
  getHistory,
  getOutput,
  uploadImage,
  uploadVideo,
  uploadAudio,
  connectWebSocket,
  freeVram,
  getSystemStats,
  type WorkflowParams,
} from "@/lib/comfyui/client";
import type {
  PostProcessJob,
  PostProcessType,
} from "./postprocess-types";
import type { WorkflowType } from "@/generated/prisma/client";

// ─── Config ───

const QUEUE_NAME = "postprocess-queue";
const POLL_INTERVAL_MS = 2000;
const MAX_JOBS_BEFORE_RESTART = 20;
const VRAM_MIN_FREE_GB = 5;    // Force restart if VRAM free drops below this
const RAM_MIN_FREE_PCT = 0.20; // Force restart if RAM free drops below 20%

/** Per-workflow timeout in milliseconds */
const WORKFLOW_TIMEOUT_MS: Record<PostProcessType, number> = {
  FACE_SWAP: 5 * 60 * 1000,      // 5 minutes
  UPSCALE: 15 * 60 * 1000,       // 15 minutes
  LIP_SYNC: 10 * 60 * 1000,      // 10 minutes
  STYLE_TRANSFER: 10 * 60 * 1000, // 10 minutes (disabled in UI but code supports it)
};

/** Max retries per workflow type */
const WORKFLOW_MAX_RETRIES: Record<PostProcessType, number> = {
  FACE_SWAP: 2,      // Retry on face detection failure
  UPSCALE: 1,        // Rarely fails; if OOM, restart first
  LIP_SYNC: 2,       // Non-deterministic quality; retry improves results
  STYLE_TRANSFER: 1,
};

const TYPE_TO_WORKFLOW: Record<PostProcessType, WorkflowType> = {
  FACE_SWAP: "FACE_SWAP",
  UPSCALE: "UPSCALE",
  LIP_SYNC: "LIP_SYNC",
  STYLE_TRANSFER: "STYLE_TRANSFER",
};

// ─── Redis ───

function getRedis(): Redis {
  return new Redis(process.env.REDIS_URL!, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
}

// ─── Download from R2 ───

async function downloadFromR2(r2Key: string): Promise<Buffer> {
  if (r2Key.startsWith("http")) {
    const res = await fetch(r2Key);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  const signedUrl = await getSignedR2Url(r2Key, 600);
  const res = await fetch(signedUrl);
  if (!res.ok) throw new Error(`R2 download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// ─── Memory management ───

/**
 * Aggressive cleanup after each job:
 * 1. POST /free to clear VRAM and model cache
 * 2. The glibc malloc_trim issue requires process restart — we do that via the restart counter
 */
async function cleanupAfterJob(unloadModels: boolean): Promise<void> {
  try {
    await freeVram(unloadModels);
    console.log(`[worker] /free completed (unload_models=${unloadModels})`);
  } catch (err) {
    console.warn(`[worker] /free failed:`, err);
  }
}

/**
 * Check if ComfyUI needs a restart based on memory pressure.
 * Returns true if VRAM or RAM is below safe thresholds.
 */
async function shouldForceRestart(): Promise<boolean> {
  const stats = await getSystemStats();
  if (!stats) return false; // Can't check — don't restart blindly

  if (stats.vramFreeGB < VRAM_MIN_FREE_GB) {
    console.warn(`[worker] VRAM critically low: ${stats.vramFreeGB.toFixed(1)} GB free (min: ${VRAM_MIN_FREE_GB} GB)`);
    return true;
  }

  if (stats.ramTotalGB > 0) {
    const ramFreePct = stats.ramFreeGB / stats.ramTotalGB;
    if (ramFreePct < RAM_MIN_FREE_PCT) {
      console.warn(`[worker] RAM critically low: ${(ramFreePct * 100).toFixed(0)}% free (min: ${RAM_MIN_FREE_PCT * 100}%)`);
      return true;
    }
  }

  return false;
}

async function restartComfyUI(): Promise<void> {
  console.log(`[worker] Restarting ComfyUI to reclaim fragmented memory...`);
  await freeVram(true).catch(() => {});

  const restartCmd = process.env.COMFYUI_RESTART_CMD;
  if (restartCmd) {
    const { exec } = await import("child_process");
    await new Promise<void>((resolve, reject) => {
      exec(restartCmd, (error) => {
        if (error) {
          console.error(`[worker] Restart command failed:`, error);
          reject(error);
        } else {
          console.log(`[worker] ComfyUI restart command executed`);
          resolve();
        }
      });
    });

    // Wait for ComfyUI to come back up — poll /system_stats
    console.log(`[worker] Waiting for ComfyUI to restart...`);
    const startWait = Date.now();
    const maxWait = 60_000;
    while (Date.now() - startWait < maxWait) {
      await sleep(3000);
      const stats = await getSystemStats();
      if (stats) {
        console.log(`[worker] ComfyUI is back (VRAM: ${stats.vramFreeGB.toFixed(1)} GB free)`);
        return;
      }
    }
    console.warn(`[worker] ComfyUI didn't respond after ${maxWait / 1000}s — continuing anyway`);
  } else {
    console.warn(`[worker] COMFYUI_RESTART_CMD not set — full VRAM free only`);
  }
}

// ─── Process a single job ───

async function processJob(job: PostProcessJob): Promise<void> {
  const { generationId, userId, type, sourceVideoR2Key, params } = job;
  const timeoutMs = WORKFLOW_TIMEOUT_MS[type];

  console.log(`[worker] Processing ${type} job: ${generationId} (timeout: ${timeoutMs / 1000}s)`);
  const startTime = Date.now();

  try {
    // Mark as PROCESSING
    await prisma.generation.update({
      where: { id: generationId },
      data: { status: "PROCESSING", startedAt: new Date(), progress: 10 },
    });

    // Download source video and upload to ComfyUI
    console.log(`[worker] Downloading source video...`);
    const videoBuffer = await downloadFromR2(sourceVideoR2Key);
    const comfyVideoName = await uploadVideo(videoBuffer, `input-${generationId}.mp4`);

    // Build workflow params
    const workflowParams: WorkflowParams = {
      inputVideoFilename: comfyVideoName,
    };

    // Upload type-specific assets to ComfyUI
    if (type === "FACE_SWAP" && params.faceImageR2Key) {
      const faceBuffer = await downloadFromR2(params.faceImageR2Key);
      const comfyFaceName = await uploadImage(faceBuffer, `face-${generationId}.png`);
      workflowParams.sourceImageFilename = comfyFaceName;
    }

    if (type === "LIP_SYNC" && params.audioFileR2Key) {
      const audioBuffer = await downloadFromR2(params.audioFileR2Key);
      const comfyAudioName = await uploadAudio(audioBuffer, `audio-${generationId}.mp3`);
      workflowParams.audioFilename = comfyAudioName;
    }

    if (type === "UPSCALE") {
      const targetRes = params.targetResolution || "1080p";
      // Upscale workflow uses NMKD-Siax 4x then Lanczos downscale
      // The downscale target dimensions are set in the workflow JSON
      // Scale factor on ImageScaleBy not used — ImageScale with fixed dimensions instead
      workflowParams.width = targetRes === "1440p" ? 2560 : 1920;
      workflowParams.height = targetRes === "1440p" ? 1440 : 1080;
    }

    if (type === "STYLE_TRANSFER" && params.stylePrompt) {
      workflowParams.prompt = params.stylePrompt;
    }

    await prisma.generation.update({
      where: { id: generationId },
      data: { progress: 20 },
    });

    // Load workflow template and inject params
    const workflowType = TYPE_TO_WORKFLOW[type];
    let workflow: Record<string, unknown>;
    try {
      workflow = loadTemplate(workflowType);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Workflow template not found for ${type} — contact support. ` +
        `The ComfyUI workflow JSON needs to be built and exported. (${msg})`
      );
    }

    const injected = injectParams(workflow, workflowParams, workflowType);

    // Submit to ComfyUI
    const clientId = randomUUID();
    console.log(`[worker] Submitting to ComfyUI...`);
    const { prompt_id: promptId } = await queuePrompt(injected, clientId);

    await prisma.generation.update({
      where: { id: generationId },
      data: { promptId, progress: 30 },
    });

    // Monitor via WebSocket + polling with per-workflow timeout
    let wsCompleted = false;
    let wsError = false;
    let lastProgress = 30;

    const ws = connectWebSocket(clientId, (data) => {
      if (data.type === "progress" && data.value && data.max) {
        const pct = Math.round(30 + (data.value / data.max) * 60);
        if (pct > lastProgress) {
          lastProgress = pct;
          prisma.generation.update({
            where: { id: generationId },
            data: { progress: pct },
          }).catch(() => {});
        }
      } else if (data.type === "complete" && data.promptId === promptId) {
        wsCompleted = true;
      } else if (data.type === "error" && data.promptId === promptId) {
        wsError = true;
      }
    });

    const deadline = Date.now() + timeoutMs;

    try {
      while (Date.now() < deadline) {
        if (wsCompleted || wsError) break;

        const history = await getHistory(promptId);
        if (history?.status.completed) {
          wsCompleted = true;
          break;
        }

        await sleep(POLL_INTERVAL_MS);
      }
    } finally {
      ws.close();
    }

    if (wsError) {
      throw new Error(`ComfyUI execution failed for ${type} — check ComfyUI logs`);
    }

    if (!wsCompleted) {
      throw new Error(`${type} execution timed out after ${timeoutMs / 1000}s`);
    }

    // Retrieve output
    await prisma.generation.update({
      where: { id: generationId },
      data: { status: "UPLOADING", progress: 90 },
    });

    const history = await getHistory(promptId);
    if (!history) {
      throw new Error("Could not retrieve ComfyUI output history");
    }

    // Find video output in history
    let outputFilename: string | null = null;
    let outputSubfolder = "";
    for (const [, nodeOutput] of Object.entries(history.outputs)) {
      const gifs = nodeOutput.gifs || nodeOutput.images;
      if (gifs && gifs.length > 0) {
        outputFilename = gifs[0].filename;
        outputSubfolder = gifs[0].subfolder;
        break;
      }
    }

    if (!outputFilename) {
      throw new Error("No output found in ComfyUI history");
    }

    // Download output from ComfyUI
    const outputBuffer = await getOutput(outputFilename, outputSubfolder, "output");

    // Upload to R2
    const r2Key = `users/${userId}/generations/${generationId}/output.mp4`;
    await uploadToR2(r2Key, outputBuffer, "video/mp4");

    // Mark complete
    const generationTimeMs = Date.now() - startTime;
    await prisma.generation.update({
      where: { id: generationId },
      data: {
        status: "COMPLETED",
        progress: 100,
        outputUrl: r2Key,
        completedAt: new Date(),
        generationTimeMs,
      },
    });

    console.log(`[worker] Job ${generationId} complete in ${(generationTimeMs / 1000).toFixed(1)}s`);

    // Cleanup VRAM — keep models loaded for cache hits on same-type jobs
    await cleanupAfterJob(false);
  } catch (error) {
    console.error(`[worker] Job ${generationId} failed:`, error);

    const errorMsg = error instanceof Error ? error.message : "Post-processing failed";
    await prisma.generation.update({
      where: { id: generationId },
      data: {
        status: "FAILED",
        errorMessage: errorMsg.slice(0, 500),
        completedAt: new Date(),
      },
    });

    // Refund credits (skip if account was deleted — credits already zeroed)
    const gen = await prisma.generation.findUnique({
      where: { id: generationId },
      select: { errorMessage: true },
    });
    if (job.creditsCost > 0 && gen?.errorMessage !== "ACCOUNT_DELETED") {
      await refundCredits(
        userId,
        job.creditsCost,
        `Refund: ${type} post-processing failed (${errorMsg.slice(0, 100)})`
      );
    }

    // Aggressive cleanup after failure — unload all models
    await cleanupAfterJob(true);
  }
}

// ─── Consumer loop ───

async function consumerLoop(): Promise<void> {
  const redis = getRedis();
  await redis.connect();
  console.log(`[worker] Post-processing worker started — listening on '${QUEUE_NAME}'`);
  console.log(`[worker] Restart cycle: every ${MAX_JOBS_BEFORE_RESTART} jobs`);
  console.log(`[worker] Memory thresholds: VRAM min ${VRAM_MIN_FREE_GB} GB, RAM min ${RAM_MIN_FREE_PCT * 100}%`);

  let jobCount = 0;

  while (true) {
    try {
      // Check memory before accepting next job
      if (jobCount > 0 && jobCount % 5 === 0) {
        const needsRestart = await shouldForceRestart();
        if (needsRestart) {
          console.warn(`[worker] Memory pressure detected after ${jobCount} jobs — forcing restart`);
          await restartComfyUI();
          jobCount = 0;
        }
      }

      const result = await redis.brpop(QUEUE_NAME, 0);
      if (!result) continue;

      const [, rawData] = result;
      const job: PostProcessJob = JSON.parse(rawData);

      // Retry loop for retryable failures
      const maxRetries = WORKFLOW_MAX_RETRIES[job.type];
      let attempt = 0;
      let succeeded = false;

      while (attempt <= maxRetries && !succeeded) {
        if (attempt > 0) {
          console.log(`[worker] Retry ${attempt}/${maxRetries} for ${job.type} job ${job.generationId}`);
          // Reset generation status for retry
          await prisma.generation.update({
            where: { id: job.generationId },
            data: {
              status: "QUEUED",
              progress: 0,
              errorMessage: null,
              retryCount: attempt,
            },
          });
          // Clean slate before retry
          await cleanupAfterJob(true);
          await sleep(2000);
        }

        try {
          await processJob(job);
          succeeded = true;
        } catch {
          attempt++;
          if (attempt > maxRetries) {
            // processJob already handled failure (DB update + refund)
            break;
          }
        }
      }

      // Restart counter
      jobCount++;
      if (jobCount >= MAX_JOBS_BEFORE_RESTART) {
        console.log(`[worker] Reached ${MAX_JOBS_BEFORE_RESTART} jobs — scheduled restart`);
        await restartComfyUI();
        jobCount = 0;
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        console.error("[worker] Invalid JSON in queue:", error.message);
      } else {
        console.error("[worker] Consumer loop error:", error);
        await sleep(2000);
      }
    }
  }
}

// ─── Helpers ───

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Entry point ───

if (require.main === module || process.argv[1]?.includes("postprocess-worker")) {
  consumerLoop().catch((err) => {
    console.error("[worker] Fatal error:", err);
    process.exit(1);
  });
}

export { processJob, consumerLoop };
