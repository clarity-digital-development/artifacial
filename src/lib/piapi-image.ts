/**
 * PiAPI image generation for character creation.
 * Replaces fal-image.ts. All models route through PiAPI's async task API.
 */

import {
  submitTask,
  waitForCompletion,
  buildImageInput,
} from "@/lib/piapi-client";

// ─── Model definitions ───

export const PIAPI_IMAGE_MODELS = [
  {
    id: "z-image-turbo",
    name: "Z-Image Turbo",
    piApiModel: "Qubico/z-image",
    taskType: "txt2img",
    costPerImage: 0.004,
    creditCost: 1,
  },
  {
    id: "flux-schnell",
    name: "Flux Schnell",
    piApiModel: "Qubico/flux1-schnell",
    taskType: "txt2img",
    costPerImage: 0.01,
    creditCost: 1,
  },
  {
    id: "qwen-image",
    name: "Qwen Image",
    piApiModel: "qwen-image",
    taskType: "txt2img",
    costPerImage: 0.015,
    creditCost: 1,
  },
  {
    id: "seedream-5",
    name: "Seedream 5 Lite",
    piApiModel: "seedream",
    taskType: "seedream-5-lite",
    costPerImage: 0.028,
    creditCost: 1,
  },
] as const;

export type PiApiImageModelId = (typeof PIAPI_IMAGE_MODELS)[number]["id"];

export function getPiApiImageModel(id: string) {
  return PIAPI_IMAGE_MODELS.find((m) => m.id === id);
}

export function isPiApiImageModel(id: string): boolean {
  return PIAPI_IMAGE_MODELS.some((m) => m.id === id);
}

// ─── Aspect ratio mapping ───

const ASPECT_RATIO_MAP: Record<string, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "3:4": { width: 768, height: 1024 },
  "4:3": { width: 1024, height: 768 },
  "2:3": { width: 682, height: 1024 },
  "3:2": { width: 1024, height: 682 },
  "4:5": { width: 819, height: 1024 },
  "5:4": { width: 1024, height: 819 },
  "9:16": { width: 576, height: 1024 },
  "16:9": { width: 1024, height: 576 },
};

// ─── Download result image ───

async function downloadImage(imageUrl: string): Promise<Buffer> {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Failed to download generated image: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

// ─── Public API ───

/**
 * Generate an image via PiAPI. Submits task, polls for completion, downloads result.
 * Returns the image as a Buffer.
 */
export async function generateImageWithPiApi(
  prompt: string,
  modelId: PiApiImageModelId,
  aspectRatio: string = "1:1",
  _referenceImageBuffer?: Buffer
): Promise<Buffer> {
  const model = getPiApiImageModel(modelId);
  if (!model) throw new Error(`Unknown PiAPI image model: ${modelId}`);

  const dims = ASPECT_RATIO_MAP[aspectRatio] ?? ASPECT_RATIO_MAP["1:1"];

  console.log(`[piapi-image] generate: model=${modelId}, aspectRatio=${aspectRatio}, dims=${dims.width}x${dims.height}`);

  const input = buildImageInput(model.piApiModel, model.taskType, {
    prompt,
    width: dims.width,
    height: dims.height,
  });

  const { taskId } = await submitTask(model.piApiModel, model.taskType, input);

  console.log(`[piapi-image] submitted: taskId=${taskId}`);

  const result = await waitForCompletion(taskId, {
    pollIntervalMs: 2000,
    maxWaitMs: 120_000,
  });

  if (result.status === "failed") {
    throw new Error(`PiAPI image generation failed: ${result.errorMessage}`);
  }

  const imageUrl = result.imageUrl || result.imageUrls?.[0];
  if (!imageUrl) {
    console.error(`[piapi-image] No image URL. status=${result.status}, raw=${JSON.stringify(result.raw).slice(0, 1000)}`);
    throw new Error("No image URL in PiAPI response");
  }

  console.log(`[piapi-image] success: model=${modelId}`);
  return downloadImage(imageUrl);
}
