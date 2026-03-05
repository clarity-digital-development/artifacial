// BullMQ queue setup for video generation jobs
// Phase 1: Single video per project via Kling API

import { Queue, Worker, type Job } from "bullmq";

// ─── Types ───

export interface VideoJobData {
  jobId: string; // GenerationJob.id in our DB
  projectId: string;
  userId: string;
  prompt: string;
  enhancedPrompt: string;
  characterImageKey?: string; // R2 key for reference image (worker signs fresh URL)
}

export interface VideoJobResult {
  videoUrl: string; // R2 key
  externalTaskId: string;
}

// ─── Redis Connection ───

const redisConnection = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null as unknown as number,
};

function parseRedisUrl(): typeof redisConnection {
  const url = process.env.REDIS_URL;
  if (!url) return redisConnection;

  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port || "6379", 10),
      password: parsed.password || undefined,
      maxRetriesPerRequest: null as unknown as number,
    };
  } catch {
    return redisConnection;
  }
}

// ─── Queue ───

let _queue: Queue<VideoJobData, VideoJobResult> | null = null;

export function getVideoQueue(): Queue<VideoJobData, VideoJobResult> {
  if (!_queue) {
    _queue = new Queue("video-generation", {
      connection: parseRedisUrl(),
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 200 },
      },
    });
  }
  return _queue;
}

// ─── Worker Factory ───

export function createVideoWorker(
  processor: (job: Job<VideoJobData, VideoJobResult>) => Promise<VideoJobResult>
): Worker<VideoJobData, VideoJobResult> {
  return new Worker("video-generation", processor, {
    connection: parseRedisUrl(),
    concurrency: 3,
    limiter: {
      max: 5,
      duration: 60_000, // Max 5 jobs per minute to respect Kling rate limits
    },
  });
}
