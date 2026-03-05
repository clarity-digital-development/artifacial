// BullMQ Worker: Video Generation via Kling API
// Phase 1: Single video per project
//
// Run separately from Next.js:
//   npx tsx src/workers/video-generator.ts
//
// Or in dev alongside Next.js:
//   npx tsx --watch src/workers/video-generator.ts

import "dotenv/config";
import { type Job } from "bullmq";
import { createVideoWorker, type VideoJobData, type VideoJobResult } from "../lib/queue";
import { submitVideoTask, getTaskStatus, downloadVideo } from "../lib/kling";
import { uploadToR2, r2KeyForProject, getSignedR2Url } from "../lib/r2";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// ─── DB Client (standalone, not using Next.js singleton) ───

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── Constants ───

const POLL_INTERVAL_MS = 10_000; // Check Kling every 10s
const MAX_POLL_ATTEMPTS = 180; // 30 min max wait (180 * 10s)

// ─── Processor ───

async function processVideoJob(
  job: Job<VideoJobData, VideoJobResult>
): Promise<VideoJobResult> {
  const { jobId, projectId, userId, enhancedPrompt, characterImageKey } = job.data;

  // Mark job as processing
  await prisma.generationJob.update({
    where: { id: jobId },
    data: { status: "processing", startedAt: new Date() },
  });
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "generating" },
  });

  // Sign a fresh URL for the character reference image (if any)
  let characterImageUrl: string | undefined;
  if (characterImageKey) {
    try {
      characterImageUrl = await getSignedR2Url(characterImageKey, 3600);
    } catch {
      // Continue without reference image
    }
  }

  const useImageMode = !!characterImageUrl;

  // Submit to Kling
  const taskId = await submitVideoTask({
    prompt: enhancedPrompt,
    image_url: characterImageUrl,
    duration: "5",
    aspect_ratio: "16:9",
  });

  // Store external task ID
  await prisma.generationJob.update({
    where: { id: jobId },
    data: { externalJobId: taskId },
  });

  // Poll for completion
  const statusType = useImageMode ? "image2video" : "text2video";
  let videoUrl: string | null = null;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);

    const status = await getTaskStatus(taskId, statusType);

    if (status.task_status === "succeed") {
      videoUrl = status.task_result?.videos?.[0]?.url ?? null;
      if (!videoUrl) throw new Error("Kling returned success but no video URL");
      break;
    }

    if (status.task_status === "failed") {
      throw new Error(status.task_status_msg ?? "Kling generation failed");
    }

    // Update progress
    await job.updateProgress(Math.min(90, (attempt / MAX_POLL_ATTEMPTS) * 100));
  }

  if (!videoUrl) {
    throw new Error("Kling generation timed out");
  }

  // Download video from Kling and upload to R2
  const videoBuffer = await downloadVideo(videoUrl);
  const r2Key = r2KeyForProject(userId, projectId);
  await uploadToR2(r2Key, videoBuffer, "video/mp4");

  // Update DB records
  await prisma.generationJob.update({
    where: { id: jobId },
    data: {
      status: "complete",
      completedAt: new Date(),
      meta: { externalTaskId: taskId, r2Key },
    },
  });
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "complete", finalVideoUrl: r2Key },
  });

  console.log(`[video-generator] Completed: project=${projectId} task=${taskId}`);
  return { videoUrl: r2Key, externalTaskId: taskId };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Failure Handler (refunds credits after all retries exhausted) ───

async function handleJobFailure(jobId: string, projectId: string, userId: string, errorMessage: string) {
  console.error(`[video-generator] Failed: project=${projectId} error=${errorMessage}`);

  await prisma.generationJob.update({
    where: { id: jobId },
    data: { status: "failed", completedAt: new Date(), error: errorMessage },
  });
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "failed" },
  });

  // Refund video credit
  await prisma.user.update({
    where: { id: userId },
    data: { videoCredits: { increment: 1 } },
  });
  await prisma.creditTransaction.create({
    data: {
      userId,
      type: "refund",
      videoCredits: 1,
      description: `Refund for failed video generation: ${errorMessage.slice(0, 100)}`,
    },
  });
}

// ─── Start Worker ───

const worker = createVideoWorker(processVideoJob);

worker.on("ready", () => console.log("[video-generator] Worker ready"));
worker.on("completed", (job) => console.log(`[video-generator] Job ${job.id} completed`));
worker.on("failed", async (job, err) => {
  if (!job) return;
  const { jobId, projectId, userId } = job.data;
  await handleJobFailure(jobId, projectId, userId, err.message);
});

process.on("SIGINT", async () => {
  console.log("[video-generator] Shutting down...");
  await worker.close();
  await pool.end();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await worker.close();
  await pool.end();
  process.exit(0);
});

console.log("[video-generator] Worker started, waiting for jobs...");
