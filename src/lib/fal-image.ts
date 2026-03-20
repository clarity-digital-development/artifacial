/**
 * fal.ai image generation for character creation.
 * Supports Flux 2 Pro, Recraft V3, and Ideogram V3.
 * All models support reference image input for character consistency.
 */

import { fal } from "@fal-ai/client";

fal.config({
  credentials: () => process.env.FAL_KEY!,
});

// ─── Model definitions ───

export const FAL_IMAGE_MODELS = [
  {
    id: "flux-2-pro",
    name: "Flux 2 Pro",
    endpoint: "fal-ai/flux-2-pro",
    editEndpoint: "fal-ai/flux-2-pro/edit",
    costPerImage: 0.03,
    creditCost: 10,
    supportsImageRef: true,
  },
  {
    id: "recraft-v3",
    name: "Recraft V3",
    endpoint: "fal-ai/recraft/v3/text-to-image",
    editEndpoint: "fal-ai/recraft/v3/image-to-image",
    costPerImage: 0.04,
    creditCost: 10,
    supportsImageRef: true,
  },
  {
    id: "ideogram-v3",
    name: "Ideogram V3",
    endpoint: "fal-ai/ideogram/v3/text-to-image",
    editEndpoint: "fal-ai/ideogram/character",
    costPerImage: 0.05,
    creditCost: 15,
    supportsImageRef: true,
  },
] as const;

export type FalImageModelId = (typeof FAL_IMAGE_MODELS)[number]["id"];

export function getFalImageModel(id: string) {
  return FAL_IMAGE_MODELS.find((m) => m.id === id);
}

export function isFalImageModel(id: string): boolean {
  return FAL_IMAGE_MODELS.some((m) => m.id === id);
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

// ─── Error helper ───

function extractFalError(err: unknown): string {
  if (err instanceof Error) {
    const anyErr = err as unknown as Record<string, unknown>;
    if (anyErr.body) {
      try {
        const body = typeof anyErr.body === "string" ? JSON.parse(anyErr.body) : anyErr.body;
        return `${err.message} | body: ${JSON.stringify(body)}`;
      } catch {
        return `${err.message} | body: ${String(anyErr.body)}`;
      }
    }
    if (anyErr.status) {
      return `${err.message} (status: ${anyErr.status})`;
    }
    return err.message;
  }
  return String(err);
}

// ─── Upload image to fal.ai CDN ───

async function uploadToFalStorage(imageBuffer: Buffer): Promise<string> {
  const file = new File([new Uint8Array(imageBuffer)], "reference.jpg", { type: "image/jpeg" });
  const url = await fal.storage.upload(file);
  console.log(`[fal-image] Uploaded to fal storage: ${url.slice(0, 80)}...`);
  return url;
}

// ─── Download result image ───

async function downloadImage(imageUrl: string): Promise<Buffer> {
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Failed to download generated image: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

// ─── Generate (text-to-image, no reference) ───

async function generateTextToImage(
  model: (typeof FAL_IMAGE_MODELS)[number],
  prompt: string,
  dims: { width: number; height: number }
): Promise<Buffer> {
  console.log(`[fal-image] T2I: model=${model.id}, endpoint=${model.endpoint}, dims=${dims.width}x${dims.height}`);

  try {
    const result = await fal.subscribe(model.endpoint, {
      input: {
        prompt,
        image_size: { width: dims.width, height: dims.height },
        num_images: 1,
      },
    });

    const data = result.data as { images?: { url: string }[] };
    const imageUrl = data?.images?.[0]?.url;
    if (!imageUrl) {
      console.error(`[fal-image] T2I no image in response:`, JSON.stringify(result.data).slice(0, 500));
      throw new Error("No image returned from fal.ai");
    }

    console.log(`[fal-image] T2I success: model=${model.id}`);
    return downloadImage(imageUrl);
  } catch (err) {
    console.error(`[fal-image] T2I error: model=${model.id}, error=${extractFalError(err)}`);
    throw err;
  }
}

// ─── Generate with reference image ───

async function generateWithReference(
  model: (typeof FAL_IMAGE_MODELS)[number],
  prompt: string,
  falImageUrl: string,
  dims: { width: number; height: number }
): Promise<Buffer> {
  let input: Record<string, unknown>;
  let endpoint: string;

  if (model.id === "flux-2-pro") {
    endpoint = model.editEndpoint;
    input = {
      prompt: `Using this reference photo as the character's face and identity: ${prompt}`,
      image_urls: [falImageUrl],
    };
  } else if (model.id === "recraft-v3") {
    endpoint = model.editEndpoint;
    input = {
      prompt,
      image_url: falImageUrl,
      strength: 0.65,
    };
  } else if (model.id === "ideogram-v3") {
    endpoint = model.editEndpoint;
    input = {
      prompt,
      reference_image_urls: [falImageUrl],
    };
  } else {
    return generateTextToImage(model, prompt, dims);
  }

  console.log(`[fal-image] Ref: model=${model.id}, endpoint=${endpoint}, falUrl=${falImageUrl.slice(0, 80)}...`);

  try {
    const result = await fal.subscribe(endpoint, { input });

    const data = result.data as { images?: { url: string }[] };
    const imageUrl = data?.images?.[0]?.url;
    if (!imageUrl) {
      console.error(`[fal-image] Ref no image in response:`, JSON.stringify(result.data).slice(0, 500));
      throw new Error("No image returned from fal.ai");
    }

    console.log(`[fal-image] Ref success: model=${model.id}`);
    return downloadImage(imageUrl);
  } catch (err) {
    console.error(`[fal-image] Ref error: model=${model.id}, endpoint=${endpoint}, error=${extractFalError(err)}`);
    throw err;
  }
}

// ─── Public API ───

export async function generateImageWithFal(
  prompt: string,
  modelId: FalImageModelId,
  aspectRatio: string = "1:1",
  referenceImageBuffer?: Buffer
): Promise<Buffer> {
  const model = getFalImageModel(modelId);
  if (!model) throw new Error(`Unknown fal image model: ${modelId}`);

  const dims = ASPECT_RATIO_MAP[aspectRatio] ?? ASPECT_RATIO_MAP["1:1"];

  console.log(`[fal-image] generate: model=${modelId}, aspectRatio=${aspectRatio}, hasRef=${!!referenceImageBuffer}`);

  if (referenceImageBuffer) {
    // Upload to fal.ai's CDN so their models can access it
    const falUrl = await uploadToFalStorage(referenceImageBuffer);
    return generateWithReference(model, prompt, falUrl, dims);
  }

  return generateTextToImage(model, prompt, dims);
}
