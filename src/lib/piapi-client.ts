/**
 * Unified PiAPI client for ALL generation tasks.
 *
 * Handles: video generation, image generation, post-processing (faceswap, upscale, bg removal).
 * Single API pattern: POST task → get task_id → poll for result.
 *
 * Replaces: fal-client.ts, piapi.ts (legacy), fal-image.ts
 */

const PIAPI_BASE_URL = "https://api.piapi.ai/api/v1";

function getApiKey(): string {
  const key = process.env.PIAPI_API_KEY;
  if (!key) throw new Error("PIAPI_API_KEY environment variable is not set");
  return key;
}

async function piapiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${PIAPI_BASE_URL}${path}`, {
    ...options,
    headers: {
      "x-api-key": getApiKey(),
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PiAPI ${res.status}: ${body}`);
  }

  return res.json();
}

// ─── Types ───

export type PiAPITaskStatus = "pending" | "processing" | "completed" | "failed";

export type PiAPISubmitResult = {
  taskId: string;
};

export type PiAPITaskResult = {
  status: PiAPITaskStatus;
  progress?: number;
  videoUrl?: string;
  imageUrl?: string;
  imageUrls?: string[];
  thumbnailUrl?: string;
  durationSec?: number;
  errorMessage?: string;
  raw?: Record<string, unknown>;
};

// ─── Task Submission ───

/**
 * Submit any task to PiAPI. All models use the same endpoint pattern.
 */
export async function submitTask(
  model: string,
  taskType: string,
  input: Record<string, unknown>,
  config?: { webhookUrl?: string; serviceMode?: "public" | "private" }
): Promise<PiAPISubmitResult> {
  const body: Record<string, unknown> = {
    model,
    task_type: taskType,
    input,
  };

  if (config?.webhookUrl || config?.serviceMode) {
    body.config = {
      ...(config.serviceMode && { service_mode: config.serviceMode }),
      ...(config.webhookUrl && {
        webhook_config: { endpoint: config.webhookUrl },
      }),
    };
  }

  console.log(`[piapi] submit: model=${model}, task_type=${taskType}, input=${JSON.stringify(input)}`);

  const data = await piapiFetch("/task", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const taskId = data.data?.task_id || data.task_id;
  if (!taskId) {
    throw new Error(`PiAPI submit failed: no task_id in response: ${JSON.stringify(data)}`);
  }

  return { taskId };
}

// ─── Task Status Polling ───

/**
 * Get the current status of a PiAPI task.
 */
export async function getTaskStatus(taskId: string): Promise<PiAPITaskResult> {
  const data = await piapiFetch(`/task/${taskId}`);
  const task = data.data || data;
  const status = (task.status as string)?.toLowerCase();

  let mappedStatus: PiAPITaskStatus;
  if (status === "completed" || status === "done" || status === "success") {
    mappedStatus = "completed";
  } else if (status === "failed" || status === "error") {
    mappedStatus = "failed";
  } else if (status === "processing" || status === "running" || status === "starting" || status === "retry") {
    mappedStatus = "processing";
  } else {
    mappedStatus = "pending";
  }

  // Extract output URLs — different task types store results differently
  let videoUrl: string | undefined;
  let imageUrl: string | undefined;
  let imageUrls: string[] | undefined;
  let thumbnailUrl: string | undefined;

  if (mappedStatus === "completed") {
    // Gemini models use task_result.task_output, others use output
    const output = task.output || task.task_result?.task_output || task.result || {};

    // Video URLs — each PiAPI model returns video in a different location:
    // Kling: output.works[0].video.resource_without_watermark or .resource
    // Veo/Seedance: output.video (direct URL string)
    // Hailuo: output.video_url
    // Wan/Sora: output.image_url (confusingly named)
    videoUrl =
      output.video_url ||
      (typeof output.video === "string" ? output.video : output.video?.url) ||
      output.works?.[0]?.video?.resource_without_watermark ||
      output.works?.[0]?.video?.resource ||
      (Array.isArray(output.videos) ? output.videos[0]?.url : undefined);

    // Single image URL — try all known PiAPI response formats
    imageUrl =
      output.image_url ||
      output.image?.url ||
      (Array.isArray(output.image_urls) ? output.image_urls[0] : undefined) ||
      (Array.isArray(output.images) ? (typeof output.images[0] === "string" ? output.images[0] : output.images[0]?.url) : undefined);

    // Multiple image URLs (for batch/faceswap/try-on)
    // PiAPI uses image_urls (array of strings) for batch results
    const imageArray = output.image_urls || output.images;
    if (Array.isArray(imageArray)) {
      imageUrls = imageArray
        .map((img: { url?: string } | string) => (typeof img === "string" ? img : img.url))
        .filter(Boolean) as string[];
    }

    // Thumbnail
    thumbnailUrl = output.thumbnail_url || output.thumbnail?.url;

    // Debug: log when completed but no media URL found
    if (!videoUrl && !imageUrl && !imageUrls?.length) {
      console.error(`[piapi] Task ${taskId} completed but no output URLs found. output keys: ${JSON.stringify(Object.keys(output))}, raw output: ${JSON.stringify(output).slice(0, 500)}`);
    }
  }

  return {
    status: mappedStatus,
    progress: task.progress ?? undefined,
    videoUrl,
    imageUrl,
    imageUrls,
    thumbnailUrl,
    durationSec: task.output?.duration ?? undefined,
    errorMessage:
      mappedStatus === "failed"
        ? task.error?.message ||
          task.error?.raw_message ||
          (typeof task.error === "string" ? task.error : undefined) ||
          task.message ||
          task.task_result?.reason ||
          task.task_result?.message ||
          "Generation failed"
        : undefined,
    raw: task,
  };
}

/**
 * Poll a task until it completes or fails.
 */
export async function waitForCompletion(
  taskId: string,
  opts: {
    pollIntervalMs?: number;
    maxWaitMs?: number;
    onProgress?: (progress: number) => void;
  } = {}
): Promise<PiAPITaskResult> {
  const pollInterval = opts.pollIntervalMs || 5000;
  const maxWait = opts.maxWaitMs || 10 * 60 * 1000;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    const result = await getTaskStatus(taskId);

    if (result.progress && opts.onProgress) {
      opts.onProgress(result.progress);
    }

    if (result.status === "completed" || result.status === "failed") {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  return {
    status: "failed",
    errorMessage: `Task timed out after ${Math.round(maxWait / 1000)}s`,
  };
}

// ─── Video Generation Helpers ───

export type VideoSubmitParams = {
  prompt: string;
  imageUrl?: string | null;
  endImageUrl?: string | null;
  videoUrl?: string | null;
  durationSec?: number;
  aspectRatio?: string;
  resolution?: string;
  withAudio?: boolean;
  negativePrompt?: string;
  motionDirection?: "image" | "video";
};

/**
 * Build PiAPI input for a video generation task based on model config.
 * Each model has different parameter names/formats.
 */
export function buildVideoInput(
  piApiModel: string,
  taskType: string,
  params: VideoSubmitParams
): Record<string, unknown> {
  const input: Record<string, unknown> = {
    prompt: params.prompt,
  };

  // ─── Kling Omni (3.0) ───
  if (piApiModel === "kling" && taskType === "omni_video_generation") {
    input.duration = params.durationSec ?? 5;
    if (params.aspectRatio) input.aspect_ratio = params.aspectRatio;
    if (params.resolution) input.resolution = params.resolution.toLowerCase(); // "720p" / "1080p"
    if (params.withAudio) input.enable_audio = true;
    // Omni uses images array for I2V, with @image_1 syntax in prompt
    if (params.imageUrl) {
      input.images = [params.imageUrl];
      if (!params.prompt.includes("@image_1")) {
        input.prompt = `@image_1 ${params.prompt}`;
      }
    }
    return input;
  }

  // ─── Kling motion_control (2.6 / 3.0) ───
  if (piApiModel === "kling" && taskType === "motion_control") {
    // character image drives the subject; reference video drives the motion
    if (params.imageUrl) input.image_url = params.imageUrl;
    if (params.videoUrl) input.video_url = params.videoUrl;
    // motion_direction: "image" = portrait/subject keeps original orientation (≤10s)
    //                   "video" = full-body follows reference video orientation (≤30s)
    input.motion_direction = params.motionDirection ?? "video";
    // motion_control does not support prompt — always remove it
    delete input.prompt;
    return input;
  }

  // ─── Kling (2.6 and below — video_generation) ───
  if (piApiModel === "kling") {
    input.duration = params.durationSec ?? 5;
    if (params.aspectRatio) input.aspect_ratio = params.aspectRatio;
    if (params.imageUrl) input.image_url = params.imageUrl;
    if (params.endImageUrl) input.image_tail_url = params.endImageUrl;
    if (params.negativePrompt) input.negative_prompt = params.negativePrompt;
    if (params.withAudio) input.enable_audio = true;
    return input;
  }

  // ─── Wan 2.6 ───
  if (piApiModel === "Wan") {
    input.duration = params.durationSec ?? 5;
    if (params.aspectRatio) input.aspect_ratio = params.aspectRatio;
    if (params.resolution) input.resolution = params.resolution.toUpperCase(); // "720P" not "720p"
    if (params.imageUrl) input.image = params.imageUrl;
    // audio defaults to true on PiAPI — explicitly disable when not requested
    input.audio = params.withAudio ?? false;
    return input;
  }

  // ─── WanX (Wan 2.1/2.2) ───
  if (piApiModel === "Qubico/wanx") {
    if (params.imageUrl) input.image = params.imageUrl;
    if (params.endImageUrl) input.end_image = params.endImageUrl;
    if (params.aspectRatio) input.aspect_ratio = params.aspectRatio;
    if (params.negativePrompt) input.negative_prompt = params.negativePrompt;
    return input;
  }

  // ─── Veo 3 / 3.1 ───
  if (piApiModel === "veo3" || piApiModel === "veo3.1") {
    if (params.durationSec) input.duration = `${params.durationSec}s`;
    if (params.aspectRatio) input.aspect_ratio = params.aspectRatio;
    if (params.resolution) input.resolution = params.resolution;
    if (params.withAudio) input.generate_audio = true;
    if (params.negativePrompt) input.negative_prompt = params.negativePrompt;
    if (params.imageUrl) input.image_url = params.imageUrl;
    if (params.endImageUrl) input.tail_image_url = params.endImageUrl;
    return input;
  }

  // ─── Sora 2 ───
  if (piApiModel === "sora2") {
    if (params.durationSec) input.duration = params.durationSec;
    if (params.aspectRatio) input.aspect_ratio = params.aspectRatio;
    if (params.resolution) input.resolution = params.resolution;
    if (params.imageUrl) input.image_url = params.imageUrl;
    return input;
  }

  // ─── Seedance ───
  if (piApiModel === "seedance") {
    if (params.durationSec) input.duration = params.durationSec;
    if (params.aspectRatio) input.aspect_ratio = params.aspectRatio;
    if (params.imageUrl) {
      input.image_urls = [params.imageUrl];
      // Seedance uses @image1 reference syntax in prompt (like Kling 3.0 Omni)
      if (!params.prompt.includes("@image1")) {
        input.prompt = `@image1 ${params.prompt}`;
      }
    }
    if (params.videoUrl) input.video_urls = [params.videoUrl];
    return input;
  }

  // ─── Framepack ───
  if (piApiModel === "Qubico/framepack") {
    if (params.imageUrl) input.start_image = params.imageUrl;
    if (params.endImageUrl) input.end_image = params.endImageUrl;
    if (params.durationSec) input.duration = params.durationSec;
    if (params.negativePrompt) input.negative_prompt = params.negativePrompt;
    return input;
  }

  // ─── SkyReels ───
  if (piApiModel === "Qubico/skyreels") {
    if (params.imageUrl) input.image = params.imageUrl;
    if (params.aspectRatio) input.aspect_ratio = params.aspectRatio;
    if (params.negativePrompt) input.negative_prompt = params.negativePrompt;
    return input;
  }

  // ─── Default: pass through common params ───
  if (params.durationSec) input.duration = params.durationSec;
  if (params.aspectRatio) input.aspect_ratio = params.aspectRatio;
  if (params.resolution) input.resolution = params.resolution;
  if (params.imageUrl) input.image_url = params.imageUrl;
  if (params.endImageUrl) input.end_image_url = params.endImageUrl;
  if (params.negativePrompt) input.negative_prompt = params.negativePrompt;

  return input;
}

// ─── Image Generation Helpers ───

export type ImageSubmitParams = {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  seed?: number;
  referenceImageUrl?: string;
};

/**
 * Build PiAPI input for image generation.
 */
export function buildImageInput(
  piApiModel: string,
  taskType: string,
  params: ImageSubmitParams
): Record<string, unknown> {
  const input: Record<string, unknown> = {
    prompt: params.prompt,
  };

  if (params.negativePrompt) input.negative_prompt = params.negativePrompt;

  // Z-Image Turbo
  if (piApiModel === "Qubico/z-image") {
    if (params.width) input.width = params.width;
    if (params.height) input.height = params.height;
    if (params.seed !== undefined) input.seed = params.seed;
    return input;
  }

  // Flux
  if (piApiModel.startsWith("Qubico/flux1")) {
    if (params.width) input.width = params.width;
    if (params.height) input.height = params.height;
    if (params.referenceImageUrl && taskType.includes("img2img")) {
      input.image_url = params.referenceImageUrl;
    }
    return input;
  }

  // Qwen Image
  if (piApiModel === "qwen-image") {
    if (params.width) input.width = Math.min(params.width, 1024);
    if (params.height) input.height = Math.min(params.height, 1024);
    if (params.seed !== undefined) input.seed = params.seed;
    return input;
  }

  // Seedream
  if (piApiModel === "seedream") {
    // Uses aspect_ratio instead of width/height
    return input;
  }

  // Gemini / Nano Banana — uses aspect_ratio, output_format, resolution, image_urls
  if (piApiModel === "gemini") {
    if (params.referenceImageUrl) {
      input.image_urls = [params.referenceImageUrl];
    }
    input.output_format = "png";
    // Derive aspect_ratio from width/height if provided
    if (params.width && params.height) {
      const ratio = params.width / params.height;
      if (Math.abs(ratio - 1) < 0.05) input.aspect_ratio = "1:1";
      else if (Math.abs(ratio - 16 / 9) < 0.05) input.aspect_ratio = "16:9";
      else if (Math.abs(ratio - 9 / 16) < 0.05) input.aspect_ratio = "9:16";
      else if (Math.abs(ratio - 4 / 3) < 0.05) input.aspect_ratio = "4:3";
      else if (Math.abs(ratio - 3 / 4) < 0.05) input.aspect_ratio = "3:4";
      else if (Math.abs(ratio - 3 / 2) < 0.05) input.aspect_ratio = "3:2";
      else if (Math.abs(ratio - 2 / 3) < 0.05) input.aspect_ratio = "2:3";
      else input.aspect_ratio = "1:1";
    }
    return input;
  }

  // Default
  if (params.width) input.width = params.width;
  if (params.height) input.height = params.height;
  return input;
}

// ─── Post-Processing Helpers ───

/**
 * Submit an image face swap task.
 */
export async function submitImageFaceSwap(
  targetImageUrl: string,
  swapImageUrl: string
): Promise<PiAPISubmitResult> {
  return submitTask("Qubico/image-toolkit", "face-swap", {
    target_image: targetImageUrl,
    swap_image: swapImageUrl,
  });
}

/**
 * Submit a video face swap task.
 */
export async function submitVideoFaceSwap(
  targetVideoUrl: string,
  swapImageUrl: string,
  opts?: { swapFacesIndex?: string; targetFacesIndex?: string }
): Promise<PiAPISubmitResult> {
  const input: Record<string, unknown> = {
    target_video: targetVideoUrl,
    swap_image: swapImageUrl,
  };
  if (opts?.swapFacesIndex) input.swap_faces_index = opts.swapFacesIndex;
  if (opts?.targetFacesIndex) input.target_faces_index = opts.targetFacesIndex;
  return submitTask("Qubico/video-toolkit", "face-swap", input);
}

/**
 * Submit a background removal task.
 */
export async function submitBackgroundRemoval(
  imageUrl: string,
  model: "RMBG-1.4" | "RMBG-2.0" | "BEN2" = "RMBG-2.0"
): Promise<PiAPISubmitResult> {
  return submitTask("Qubico/image-toolkit", "background-remove", {
    image: imageUrl,
    rmbg_model: model,
  });
}

/**
 * Submit a Kling virtual try-on task.
 */
export async function submitVirtualTryOn(
  personImageUrl: string,
  garments: {
    dressUrl?: string;
    upperUrl?: string;
    lowerUrl?: string;
  }
): Promise<PiAPISubmitResult> {
  const input: Record<string, unknown> = {
    model_input: personImageUrl,
  };
  if (garments.dressUrl) input.dress_input = garments.dressUrl;
  if (garments.upperUrl) input.upper_input = garments.upperUrl;
  if (garments.lowerUrl) input.lower_input = garments.lowerUrl;
  return submitTask("kling", "ai_try_on", input);
}

/**
 * Submit an AI hug video task.
 */
export async function submitAIHug(
  imageUrl: string
): Promise<PiAPISubmitResult> {
  return submitTask("Qubico/hug-video", "image_to_video", {
    image_url: imageUrl,
  });
}

// ─── Cost Estimation ───

/**
 * Approximate USD costs per model for internal margin tracking.
 * Based on PiAPI published pricing.
 */
const COST_ESTIMATES: Record<string, {
  perSecond?: number;
  perRequest?: number;
  perImage?: number;
  perFrame?: number;
}> = {
  // Video — Kling
  "kling-26-std": { perSecond: 0.04 },
  "kling-26-pro": { perSecond: 0.066 },
  "kling-30-std": { perSecond: 0.04 },
  "kling-30-pro": { perSecond: 0.066 },
  // Video — Wan
  "wan-26": { perSecond: 0.08 },
  "wan-26-1080p": { perSecond: 0.12 },
  "wan-22": { perRequest: 0.28 },
  // Video — Veo
  "veo-3": { perSecond: 0.12 },
  "veo-31": { perSecond: 0.12 },
  "veo-3-audio": { perSecond: 0.24 },
  "veo-31-audio": { perSecond: 0.24 },
  // Video — Sora
  "sora-2": { perSecond: 0.08 },
  "sora-2-pro": { perSecond: 0.24 },
  // Video — Seedance
  "seedance-2": { perSecond: 0.15 },
  "seedance-2-fast": { perSecond: 0.08 },
  // Video — Other
  "framepack": { perSecond: 0.03 },
  "skyreels": { perRequest: 0.15 },
  "ai-hug": { perRequest: 0.20 },
  // Image
  "z-image": { perImage: 0.004 },
  "flux-schnell": { perImage: 0.01 },
  "flux-dev": { perImage: 0.02 },
  "qwen-image": { perImage: 0.015 },
  "seedream": { perImage: 0.028 },
  // Post-processing
  "face-swap-image": { perImage: 0.01 },
  "face-swap-video": { perFrame: 0.004 },
  "bg-remove": { perImage: 0.001 },
  "virtual-try-on": { perImage: 0.07 },
  // Venice AI
  "venice-wan-26": { perSecond: 0.08 },
  "venice-wan-22": { perRequest: 0.20 },
  "venice-wan-25-preview": { perSecond: 0.09 },
  "venice-wan-21-pro": { perRequest: 0.25 },
};

/**
 * Estimate the USD API cost for a generation.
 */
export function estimateApiCost(
  costKey: string,
  opts?: { durationSec?: number; frameCount?: number }
): number {
  const est = COST_ESTIMATES[costKey];
  if (!est) return 0;
  if (est.perRequest != null) return est.perRequest;
  if (est.perSecond != null) return est.perSecond * (opts?.durationSec ?? 5);
  if (est.perImage != null) return est.perImage;
  if (est.perFrame != null) return est.perFrame * (opts?.frameCount ?? 150);
  return 0;
}
