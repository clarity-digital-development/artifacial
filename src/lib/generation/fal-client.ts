import { fal } from "@fal-ai/client";
import {
  MODEL_REGISTRY,
  getModelById,
  getModelEndpoint,
  type ModelConfig,
  type ModelMode,
} from "@/lib/models/registry";

// ─── Initialize fal.ai client ───

fal.config({
  credentials: () => process.env.FAL_KEY!,
});

// ─── Types ───

export type FalSubmitResult = {
  requestId: string;
  modelId: string;
  endpoint: string;
};

export type FalStatusResult = {
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  progress?: number;
  logs?: Array<{ message: string; timestamp: string }>;
};

export type FalGenerationResult = {
  videoUrl: string;
  thumbnailUrl?: string;
  durationSec?: number;
  metadata?: Record<string, unknown>;
};

// ─── Resolve generation mode from params ───

function resolveMode(model: ModelConfig, hasImage: boolean): ModelMode {
  if (model.supportedModes.includes("MOTION_TRANSFER")) return "MOTION_TRANSFER";
  if (hasImage && model.supportedModes.includes("I2V")) return "I2V";
  return "T2V";
}

// ─── Submit ───

/**
 * Submit a standard T2V or I2V generation to fal.ai.
 */
export async function submitGeneration(
  modelId: string,
  params: {
    prompt: string;
    imageUrl?: string;
    durationSec?: number;
    aspectRatio?: string;
    withAudio?: boolean;
  }
): Promise<FalSubmitResult> {
  const model = getModelById(modelId);
  if (!model || model.provider !== "FAL") {
    throw new Error(`Model ${modelId} is not a fal.ai model`);
  }

  const mode = resolveMode(model, !!params.imageUrl);
  const endpoint = getModelEndpoint(modelId, mode);
  if (!endpoint) {
    throw new Error(`No ${mode} endpoint for model ${modelId}`);
  }

  const duration = Math.min(params.durationSec ?? 5, model.maxDuration);

  const input: Record<string, unknown> = {
    prompt: params.prompt,
    duration: String(duration),
  };

  if (params.imageUrl) {
    input.image_url = params.imageUrl;
  }

  if (params.aspectRatio) {
    input.aspect_ratio = params.aspectRatio;
  }

  if (params.withAudio && model.supportsAudio) {
    input.with_audio = true;
  }

  const { request_id } = await fal.queue.submit(endpoint, { input });

  return {
    requestId: request_id,
    modelId,
    endpoint,
  };
}

/**
 * Submit a motion control generation to fal.ai (Kling 2.6 Motion).
 */
export async function submitMotionControl(
  modelId: string,
  params: {
    prompt: string;
    imageUrl: string;
    videoUrl: string;
    characterOrientation: "image" | "video";
    durationSec?: number;
    aspectRatio?: string;
  }
): Promise<FalSubmitResult> {
  const model = getModelById(modelId);
  if (!model || model.provider !== "FAL") {
    throw new Error(`Model ${modelId} is not a fal.ai model`);
  }

  const endpoint = model.endpoints.motionControl;
  if (!endpoint) {
    throw new Error(`Model ${modelId} does not support motion control`);
  }

  const duration = Math.min(params.durationSec ?? 5, model.maxDuration);

  const input: Record<string, unknown> = {
    prompt: params.prompt,
    image_url: params.imageUrl,
    video_url: params.videoUrl,
    character_orientation: params.characterOrientation,
    duration: String(duration),
  };

  if (params.aspectRatio) {
    input.aspect_ratio = params.aspectRatio;
  }

  const { request_id } = await fal.queue.submit(endpoint, { input });

  return {
    requestId: request_id,
    modelId,
    endpoint,
  };
}

// ─── Status & Result ───

/**
 * Check the status of a queued fal.ai generation.
 */
export async function pollStatus(
  endpoint: string,
  requestId: string
): Promise<FalStatusResult> {
  const status = await fal.queue.status(endpoint, {
    requestId,
    logs: true,
  });

  if (status.status === "COMPLETED") {
    return { status: "COMPLETED", progress: 100 };
  }

  const mappedStatus =
    status.status === "IN_QUEUE"
      ? "IN_QUEUE"
      : status.status === "IN_PROGRESS"
        ? "IN_PROGRESS"
        : "IN_QUEUE";

  return {
    status: mappedStatus,
    progress: status.status === "IN_PROGRESS" ? 50 : 0,
    logs: (status as { logs?: Array<{ message: string; timestamp: string }> }).logs,
  };
}

/**
 * Retrieve the completed result from fal.ai.
 */
export async function getResult(
  endpoint: string,
  requestId: string
): Promise<FalGenerationResult> {
  const result = await fal.queue.result(endpoint, { requestId });
  const data = result.data as Record<string, unknown>;

  const videoUrl =
    (data.video_url as string) ??
    (data.video as { url: string })?.url ??
    ((data.videos as Array<{ url: string }>)?.[0]?.url);

  if (!videoUrl) {
    throw new Error("No video URL in fal.ai response");
  }

  const thumbnailUrl =
    (data.thumbnail_url as string) ??
    (data.thumbnail as { url: string })?.url;

  return {
    videoUrl,
    thumbnailUrl: thumbnailUrl ?? undefined,
    durationSec: data.duration as number | undefined,
    metadata: data,
  };
}

// ─── Cost Estimation (for margin tracking) ───

// Approximate USD costs per model for internal tracking.
// These are rough estimates — actual costs come from fal.ai billing.
const COST_ESTIMATES: Record<string, { perSecond?: number; perRequest?: number }> = {
  "ltx-19b": { perRequest: 0.05 },
  "wan-26": { perSecond: 0.04 },
  "hailuo-23": { perSecond: 0.045 },
  "seedance-15": { perSecond: 0.05 },
  "kling-25-turbo": { perSecond: 0.07 },
  "sora-2-pro": { perSecond: 0.10 },
  "kling-30-pro": { perSecond: 0.112 },
  "veo-31": { perSecond: 0.15 },
  "kling-26-motion-std": { perRequest: 0.40 },
  "kling-26-motion-pro": { perRequest: 0.80 },
};

/**
 * Estimate the USD API cost for a generation (for internal margin tracking).
 */
export function estimateApiCost(modelId: string, durationSec: number): number {
  const est = COST_ESTIMATES[modelId];
  if (!est) return 0;
  if (est.perRequest != null) return est.perRequest;
  if (est.perSecond != null) return est.perSecond * durationSec;
  return 0;
}

/**
 * Get all fal.ai model IDs from the registry.
 */
export function getFalModelIds(): string[] {
  return Object.values(MODEL_REGISTRY)
    .filter((m) => m.provider === "FAL")
    .map((m) => m.id);
}
