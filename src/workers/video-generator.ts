// BullMQ Worker: Video Generation via Kling API
// Supports: text-to-video, image-to-video, face swap
//
// Run separately from Next.js:
//   npx tsx src/workers/video-generator.ts
//
// Or in dev alongside Next.js:
//   npx tsx --watch src/workers/video-generator.ts

import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
import { type Job } from "bullmq";
import { createVideoWorker, type VideoJobData, type VideoJobResult } from "../lib/queue";
import { submitText2Video, submitImage2Video, submitFaceSwap, getTaskStatus, downloadVideo } from "../lib/kling";
import { uploadToR2, r2KeyForProject, getSignedR2Url } from "../lib/r2";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// ─── DB Client (standalone, not using Next.js singleton) ───

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── Constants ───

const POLL_INTERVAL_MS = 10_000;
const MAX_POLL_ATTEMPTS = 180; // 30 min max wait

// ─── Processor ───

async function processVideoJob(
  job: Job<VideoJobData, VideoJobResult>
): Promise<VideoJobResult> {
  const {
    jobId,
    projectId,
    userId,
    mode,
    enhancedPrompt,
    duration,
    aspectRatio,
    characterImageKey,
    sourceVideoKey,
    sourceImageKey,
  } = job.data;

  console.log(`[video-generator] Processing: project=${projectId} mode=${mode} jobId=${jobId}`);

  // Mark job as processing
  await prisma.generationJob.update({
    where: { id: jobId },
    data: { status: "processing", startedAt: new Date() },
  });
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "generating" },
  });

  // Sign fresh URLs for any R2 keys
  const signUrl = async (key?: string) => {
    if (!key) return undefined;
    try {
      return await getSignedR2Url(key, 3600);
    } catch {
      return undefined;
    }
  };

  const characterImageUrl = await signUrl(characterImageKey);
  const sourceVideoUrl = await signUrl(sourceVideoKey);
  const sourceImageUrl = await signUrl(sourceImageKey);

  // Submit to Kling based on mode
  let taskId: string;
  let statusType: "text2video" | "image2video" | "face-swap";

  const jobMode = mode ?? "text2video"; // backwards compat

  if (jobMode === "faceswap") {
    if (!sourceVideoUrl) throw new Error("Source video URL not available");
    if (!characterImageUrl) throw new Error("Character image URL not available");

    taskId = await submitFaceSwap({
      source_face_url: characterImageUrl,
      target_video_url: sourceVideoUrl,
    });
    statusType = "face-swap";
  } else if (jobMode === "image2video") {
    // Use uploaded image or character reference
    const imageUrl = sourceImageUrl ?? characterImageUrl;
    if (!imageUrl) throw new Error("No source image available");

    taskId = await submitImage2Video({
      image_url: imageUrl,
      prompt: enhancedPrompt || undefined,
      duration: duration as "5" | "10",
      aspect_ratio: aspectRatio as "16:9" | "9:16" | "1:1",
    });
    statusType = "image2video";
  } else {
    // text2video (default)
    taskId = await submitText2Video({
      prompt: enhancedPrompt,
      image_url: characterImageUrl,
      duration: duration as "5" | "10",
      aspect_ratio: aspectRatio as "16:9" | "9:16" | "1:1",
    });
    statusType = characterImageUrl ? "image2video" : "text2video";
  }

  console.log(`[video-generator] Submitted to Kling: taskId=${taskId} statusType=${statusType}`);

  // Store external task ID
  await prisma.generationJob.update({
    where: { id: jobId },
    data: { externalJobId: taskId },
  });

  // Poll for completion
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
      meta: { externalTaskId: taskId, r2Key, mode: jobMode },
    },
  });
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "complete", finalVideoUrl: r2Key },
  });

  console.log(`[video-generator] Completed: project=${projectId} mode=${jobMode} task=${taskId}`);
  return { videoUrl: r2Key, externalTaskId: taskId };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Failure Handler ───

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

  // Refund credits to purchasedCredits pool
  const REFUND_AMOUNT = 200;
  await prisma.user.update({
    where: { id: userId },
    data: { purchasedCredits: { increment: REFUND_AMOUNT } },
  });
  await prisma.creditTransaction.create({
    data: {
      userId,
      type: "refund",
      credits: REFUND_AMOUNT,
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
