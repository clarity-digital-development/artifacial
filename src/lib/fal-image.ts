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

// ─── Generate (text-to-image, no reference) ───

async function generateTextToImage(
  model: (typeof FAL_IMAGE_MODELS)[number],
  prompt: string,
  dims: { width: number; height: number }
): Promise<Buffer> {
  const result = await fal.subscribe(model.endpoint, {
    input: {
      prompt,
      image_size: { width: dims.width, height: dims.height },
      num_images: 1,
    },
  });

  const data = result.data as { images?: { url: string }[] };
  const imageUrl = data?.images?.[0]?.url;
  if (!imageUrl) throw new Error("No image returned from fal.ai");

  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Failed to download generated image: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

// ─── Generate with reference image ───

async function generateWithReference(
  model: (typeof FAL_IMAGE_MODELS)[number],
  prompt: string,
  referenceImageBase64: string,
  dims: { width: number; height: number }
): Promise<Buffer> {
  const dataUri = `data:image/jpeg;base64,${referenceImageBase64}`;

  let result;

  if (model.id === "flux-2-pro") {
    // Flux 2 Pro Edit: image_urls + prompt
    result = await fal.subscribe(model.editEndpoint, {
      input: {
        prompt: `Using this reference photo as the character's face and identity: ${prompt}`,
        image_urls: [dataUri],
        image_size: { width: dims.width, height: dims.height },
      },
    });
  } else if (model.id === "recraft-v3") {
    // Recraft V3 Image-to-Image: image_url + prompt + strength
    result = await fal.subscribe(model.editEndpoint, {
      input: {
        prompt,
        image_url: dataUri,
        strength: 0.65,
      },
    });
  } else if (model.id === "ideogram-v3") {
    // Ideogram Character: reference_image_urls + prompt
    result = await fal.subscribe(model.editEndpoint, {
      input: {
        prompt,
        reference_image_urls: [dataUri],
        image_size: { width: dims.width, height: dims.height },
      },
    });
  } else {
    // Fallback to text-to-image
    return generateTextToImage(model, prompt, dims);
  }

  const data = result.data as { images?: { url: string }[] };
  const imageUrl = data?.images?.[0]?.url;
  if (!imageUrl) throw new Error("No image returned from fal.ai");

  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error(`Failed to download generated image: ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

// ─── Public API ───

export async function generateImageWithFal(
  prompt: string,
  modelId: FalImageModelId,
  aspectRatio: string = "1:1",
  referenceImageBase64?: string
): Promise<Buffer> {
  const model = getFalImageModel(modelId);
  if (!model) throw new Error(`Unknown fal image model: ${modelId}`);

  const dims = ASPECT_RATIO_MAP[aspectRatio] ?? ASPECT_RATIO_MAP["1:1"];

  if (referenceImageBase64) {
    return generateWithReference(model, prompt, referenceImageBase64, dims);
  }

  return generateTextToImage(model, prompt, dims);
}
