/**
 * KIE.AI client for Kling 3.0 Motion Control.
 * Direct KIE.AI API integration — supports background_source and character_orientation
 * natively, which is not fully supported via PiAPI.
 *
 * API docs: https://docs.kie.ai/market/kling/motion-control-v3
 */
import sharp from "sharp";
import { uploadToR2, getSignedR2Url } from "@/lib/r2";

const KIEAI_BASE_URL = "https://api.kie.ai";
const KIEAI_UPLOAD_URL = "https://kieai.redpandaai.co";

function getApiKey(): string {
  const key = process.env.KIE_AI_API_KEY;
  if (!key) throw new Error("KIE_AI_API_KEY environment variable is not set");
  return key;
}

async function kieAiFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Authorization": `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  const data = await res.json();

  if (!res.ok || (typeof data.code === "number" && data.code !== 200)) {
    throw new Error(`KIE.AI ${data.code ?? res.status}: ${data.msg ?? JSON.stringify(data).slice(0, 300)}`);
  }

  return data;
}

// ─── WebP → JPEG conversion ───

/**
 * KIE.AI only accepts JPEG/JPG/PNG images. Character images are stored as WebP
 * (Gemini/PiAPI output). This converts WebP to JPEG via sharp and stores the
 * result temporarily in R2, returning a fresh signed URL for the converted file.
 */
async function ensureJpeg(imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl);
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("webp")) return imageUrl;

  console.log("[kieai] Converting WebP→JPEG for KIE.AI compatibility...");
  const buf = Buffer.from(await res.arrayBuffer());
  const jpeg = await sharp(buf).jpeg({ quality: 90 }).toBuffer();

  const key = `temp/kieai-convert/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  await uploadToR2(key, jpeg, "image/jpeg");
  const convertedUrl = await getSignedR2Url(key, 7200);
  console.log(`[kieai] WebP→JPEG done, temp key: ${key}`);
  return convertedUrl;
}

// ─── File Upload ───

/**
 * Upload a file to KIE.AI hosting from a remote URL.
 * Returns the KIE.AI-hosted file URL for use in generation requests.
 * Uploaded files expire after 3 days.
 */
export async function uploadToKieAi(fileUrl: string): Promise<string> {
  console.log(`[kieai] Uploading file from URL: ${fileUrl.slice(0, 100)}...`);

  const data = await kieAiFetch(`${KIEAI_UPLOAD_URL}/api/file-url-upload`, {
    method: "POST",
    body: JSON.stringify({ fileUrl, uploadPath: "artifacial" }),
  });

  const uploadedUrl = data.data?.fileUrl || data.data?.downloadUrl;
  if (!uploadedUrl) {
    throw new Error(`KIE.AI upload returned no file URL: ${JSON.stringify(data).slice(0, 300)}`);
  }

  console.log(`[kieai] Upload success: ${String(uploadedUrl).slice(0, 100)}...`);
  return uploadedUrl as string;
}

// ─── Task Submission ───

export type KieAiMotionControlParams = {
  imageUrl: string;            // R2 signed URL for the character reference image
  videoUrl: string;            // R2 signed URL for the motion reference video
  prompt?: string;             // Optional scene/environment description
  mode?: "720p" | "1080p";
  characterOrientation?: "video" | "image";   // Which input drives character body orientation
  backgroundSource?: "input_video" | "input_image"; // Which input provides the background
  callbackUrl: string;         // Webhook URL — KIE.AI requires this field
};

/**
 * Submit a Kling 3.0 motion-control task to KIE.AI.
 * Uploads both image and video to KIE.AI hosting first, then submits the task.
 */
export async function submitKieAiMotionControl(
  params: KieAiMotionControlParams
): Promise<{ taskId: string }> {
  // Convert WebP→JPEG if needed (KIE.AI only accepts JPEG/PNG)
  const safeImageUrl = await ensureJpeg(params.imageUrl);

  // Upload both files to KIE.AI hosting concurrently (external URLs expire)
  console.log(`[kieai] Uploading image + video to KIE.AI hosting...`);
  const [kieAiImageUrl, kieAiVideoUrl] = await Promise.all([
    uploadToKieAi(safeImageUrl),
    uploadToKieAi(params.videoUrl),
  ]);

  const mode = params.mode ?? "720p";
  // KIE.AI recommended default: "video" (character follows video motion, video background)
  const orientation = params.characterOrientation ?? "video";
  const bgSource = params.backgroundSource ?? "input_video";

  const requestBody = {
    model: "kling-3.0/motion-control",
    callBackUrl: params.callbackUrl,
    input: {
      prompt: params.prompt ?? "",
      input_urls: [kieAiImageUrl],
      video_urls: [kieAiVideoUrl],
      mode,
      character_orientation: orientation,
      background_source: bgSource,
    },
  };

  // Log full request body so Railway logs show exactly what is sent to KIE.AI
  console.log(`[kieai] FULL REQUEST BODY: ${JSON.stringify(requestBody)}`);

  const data = await kieAiFetch(`${KIEAI_BASE_URL}/api/v1/jobs/createTask`, {
    method: "POST",
    body: JSON.stringify(requestBody),
  });

  const taskId = data.data?.taskId as string | undefined;
  if (!taskId) {
    throw new Error(`KIE.AI returned no taskId: ${JSON.stringify(data).slice(0, 300)}`);
  }

  console.log(`[kieai] Task submitted: taskId=${taskId}`);
  return { taskId };
}

// ─── Nano Banana Edit ───

export type KieAiNanaBananaEditParams = {
  imageUrl: string;
  referenceImageUrl?: string;   // Optional reference image to guide the edit
  prompt: string;
  outputFormat?: "png" | "jpeg";
  imageSize?: "1:1" | "9:16" | "16:9" | "3:4" | "4:3" | "3:2" | "2:3" | "5:4" | "4:5" | "21:9" | "auto";
  callbackUrl: string;
};

/**
 * Submit a Google Nano Banana Edit task to KIE.AI.
 * Accepts jpeg, png, or webp — still converts WebP to JPEG defensively for
 * consistency with other KIE.AI endpoints.
 */
export async function submitNanoBananaEdit(
  params: KieAiNanaBananaEditParams
): Promise<{ taskId: string }> {
  const safeImageUrl = await ensureJpeg(params.imageUrl);

  console.log(`[kieai] Uploading image for Nano Banana Edit...`);
  const imageUrls: string[] = [await uploadToKieAi(safeImageUrl)];

  if (params.referenceImageUrl) {
    const safeRefUrl = await ensureJpeg(params.referenceImageUrl);
    const kieAiRefUrl = await uploadToKieAi(safeRefUrl);
    imageUrls.push(kieAiRefUrl);
    console.log(`[kieai] Reference image uploaded: ${kieAiRefUrl.slice(0, 80)}...`);
  }

  const requestBody = {
    model: "google/nano-banana-edit",
    callBackUrl: params.callbackUrl,
    input: {
      prompt: params.prompt,
      image_urls: imageUrls,
      output_format: params.outputFormat ?? "jpeg",
      image_size: params.imageSize ?? "auto",
    },
  };

  console.log(`[kieai] NANO BANANA EDIT REQUEST: ${JSON.stringify(requestBody)}`);

  const data = await kieAiFetch(`${KIEAI_BASE_URL}/api/v1/jobs/createTask`, {
    method: "POST",
    body: JSON.stringify(requestBody),
  });

  const taskId = data.data?.taskId as string | undefined;
  if (!taskId) {
    throw new Error(`KIE.AI Nano Banana Edit returned no taskId: ${JSON.stringify(data).slice(0, 300)}`);
  }

  console.log(`[kieai] Nano Banana Edit task submitted: taskId=${taskId}`);
  return { taskId };
}

// ─── Task Status ───

export type KieAiTaskStatus = "waiting" | "queuing" | "generating" | "success" | "fail";

export type KieAiTaskResult = {
  status: KieAiTaskStatus;
  videoUrl?: string;
  imageUrls?: string[];
  resultUrls?: string[];
  errorMessage?: string;
  progress?: number;
};

/**
 * Poll the status of a KIE.AI task.
 */
export async function getKieAiTaskStatus(taskId: string): Promise<KieAiTaskResult> {
  const data = await kieAiFetch(
    `${KIEAI_BASE_URL}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`
  );

  const task = data.data as Record<string, unknown>;

  // Log raw task data on first call to capture actual field names from KIE.AI
  console.log(`[kieai] recordInfo raw task fields for ${taskId}: ${JSON.stringify(task).slice(0, 500)}`);

  // KIE.AI may use "state" or "status" for the task state field — handle both
  const state = (task?.state ?? task?.status ?? task?.taskStatus) as KieAiTaskStatus;

  let videoUrl: string | undefined;
  let resultUrls: string[] | undefined;

  if (state === "success" && task.resultJson) {
    try {
      const result = JSON.parse(task.resultJson as string) as { resultUrls?: string[] };
      if (Array.isArray(result.resultUrls) && result.resultUrls.length > 0) {
        resultUrls = result.resultUrls;
        videoUrl = result.resultUrls[0];
      }
    } catch {
      console.error(`[kieai] Failed to parse resultJson for task=${taskId}: ${task.resultJson}`);
    }
  }

  // Also try direct resultUrls field in case resultJson isn't used
  if (!resultUrls && state === "success") {
    const direct = task?.resultUrls as string[] | undefined;
    if (Array.isArray(direct) && direct.length > 0) {
      resultUrls = direct;
      videoUrl = direct[0];
    }
  }

  const errorMessage = (task?.failMsg ?? task?.errorMsg ?? task?.error) as string | undefined;

  return {
    status: state,
    videoUrl,
    resultUrls,
    imageUrls: resultUrls,
    errorMessage: errorMessage || undefined,
    progress: task?.progress as number | undefined,
  };
}

// ── Ideogram Character (place person in new scene) ──

export interface KieAiIdeogramCharacterParams {
  referenceImageUrl: string;
  prompt: string;
  style?: "AUTO" | "REALISTIC" | "FICTION";
  renderingSpeed?: "TURBO" | "BALANCED" | "QUALITY";
  imageSize?: string; // e.g. "square_hd", "portrait_4_3", "portrait_16_9", "landscape_4_3", "landscape_16_9"
  numImages?: number; // 1-4
  seed?: number;
  negativePrompt?: string;
  expandPrompt?: boolean;
  callbackUrl: string;
}

export async function submitIdeogramCharacter(
  params: KieAiIdeogramCharacterParams
): Promise<{ taskId: string }> {
  const refUrl = await ensureJpeg(params.referenceImageUrl);
  const kieRefUrl = await uploadToKieAi(refUrl);

  const requestBody = {
    model: "ideogram/character",
    callBackUrl: params.callbackUrl,
    input: {
      prompt: params.prompt,
      reference_image_urls: [kieRefUrl],
      ...(params.style && { style: params.style }),
      ...(params.renderingSpeed && { rendering_speed: params.renderingSpeed }),
      ...(params.imageSize && { image_size: params.imageSize }),
      ...(params.numImages && { num_images: String(params.numImages) }),
      ...(params.seed !== undefined && { seed: params.seed }),
      ...(params.negativePrompt && { negative_prompt: params.negativePrompt }),
      ...(params.expandPrompt !== undefined && { expand_prompt: params.expandPrompt }),
    },
  };

  console.log(`[kieai] IDEOGRAM CHARACTER REQUEST: ${JSON.stringify(requestBody)}`);

  const data = await kieAiFetch(`${KIEAI_BASE_URL}/api/v1/jobs/createTask`, {
    method: "POST",
    body: JSON.stringify(requestBody),
  });

  const taskId = data.data?.taskId as string | undefined;
  if (!taskId) {
    throw new Error(`KIE.AI ideogram/character returned no taskId: ${JSON.stringify(data).slice(0, 300)}`);
  }

  console.log(`[kieai] Ideogram Character task submitted: taskId=${taskId}`);
  return { taskId };
}

// ── Ideogram Character Remix (background/scene swap with character ref) ──

export interface KieAiIdeogramCharacterRemixParams {
  imageUrl: string;          // Source image to remix
  referenceImageUrl: string; // Character reference to maintain
  prompt: string;
  strength?: number; // 0.1–1.0
  style?: "AUTO" | "REALISTIC" | "FICTION";
  renderingSpeed?: "TURBO" | "BALANCED" | "QUALITY";
  imageSize?: string;
  numImages?: number;
  seed?: number;
  negativePrompt?: string;
  expandPrompt?: boolean;
  callbackUrl: string;
}

export async function submitIdeogramCharacterRemix(
  params: KieAiIdeogramCharacterRemixParams
): Promise<{ taskId: string }> {
  const [safeSrcUrl, safeRefUrl] = await Promise.all([
    ensureJpeg(params.imageUrl),
    ensureJpeg(params.referenceImageUrl),
  ]);
  const [kieSrcUrl, kieRefUrl] = await Promise.all([
    uploadToKieAi(safeSrcUrl),
    uploadToKieAi(safeRefUrl),
  ]);

  const requestBody = {
    model: "ideogram/character-remix",
    callBackUrl: params.callbackUrl,
    input: {
      prompt: params.prompt,
      image_url: kieSrcUrl,
      reference_image_urls: [kieRefUrl],
      ...(params.strength !== undefined && { strength: params.strength }),
      ...(params.style && { style: params.style }),
      ...(params.renderingSpeed && { rendering_speed: params.renderingSpeed }),
      ...(params.imageSize && { image_size: params.imageSize }),
      ...(params.numImages && { num_images: String(params.numImages) }),
      ...(params.seed !== undefined && { seed: params.seed }),
      ...(params.negativePrompt && { negative_prompt: params.negativePrompt }),
      ...(params.expandPrompt !== undefined && { expand_prompt: params.expandPrompt }),
    },
  };

  console.log(`[kieai] IDEOGRAM CHARACTER REMIX REQUEST: ${JSON.stringify(requestBody)}`);

  const data = await kieAiFetch(`${KIEAI_BASE_URL}/api/v1/jobs/createTask`, {
    method: "POST",
    body: JSON.stringify(requestBody),
  });

  const taskId = data.data?.taskId as string | undefined;
  if (!taskId) {
    throw new Error(`KIE.AI ideogram/character-remix returned no taskId: ${JSON.stringify(data).slice(0, 300)}`);
  }

  console.log(`[kieai] Ideogram Character Remix task submitted: taskId=${taskId}`);
  return { taskId };
}

// ── Recraft Crisp Upscale ──

export async function submitRecraftCrispUpscale(params: {
  imageUrl: string;
  callbackUrl: string;
}): Promise<{ taskId: string }> {
  const jpegUrl = await ensureJpeg(params.imageUrl);
  const kieUrl = await uploadToKieAi(jpegUrl);

  const requestBody = {
    model: "recraft/crisp-upscale",
    callBackUrl: params.callbackUrl,
    input: { image: kieUrl },
  };

  console.log(`[kieai] RECRAFT CRISP UPSCALE REQUEST: ${JSON.stringify(requestBody)}`);

  const data = await kieAiFetch(`${KIEAI_BASE_URL}/api/v1/jobs/createTask`, {
    method: "POST",
    body: JSON.stringify(requestBody),
  });

  const taskId = data.data?.taskId as string | undefined;
  if (!taskId) {
    throw new Error(`KIE.AI recraft/crisp-upscale returned no taskId: ${JSON.stringify(data).slice(0, 300)}`);
  }

  console.log(`[kieai] Recraft Crisp Upscale task submitted: taskId=${taskId}`);
  return { taskId };
}

// ── Grok Imagine Video Upscale ──

export async function submitGrokVideoUpscale(params: {
  sourceTaskId: string; // KIE.AI task_id from a previous grok-imagine video generation
  callbackUrl: string;
}): Promise<{ taskId: string }> {
  const requestBody = {
    model: "grok-imagine/upscale",
    callBackUrl: params.callbackUrl,
    input: { task_id: params.sourceTaskId },
  };

  console.log(`[kieai] GROK VIDEO UPSCALE REQUEST: ${JSON.stringify(requestBody)}`);

  const data = await kieAiFetch(`${KIEAI_BASE_URL}/api/v1/jobs/createTask`, {
    method: "POST",
    body: JSON.stringify(requestBody),
  });

  const taskId = data.data?.taskId as string | undefined;
  if (!taskId) {
    throw new Error(`KIE.AI grok-imagine/upscale returned no taskId: ${JSON.stringify(data).slice(0, 300)}`);
  }

  console.log(`[kieai] Grok Video Upscale task submitted: taskId=${taskId}`);
  return { taskId };
}
