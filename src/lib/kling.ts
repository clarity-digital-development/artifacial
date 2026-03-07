// Kling 2.6 Video Generation API client
// Supports: text-to-video, image-to-video, face swap

import { createHmac } from "crypto";

const BASE_URL = () => process.env.KLING_API_BASE_URL ?? "https://api.klingai.com";
const ACCESS_KEY = () => process.env.KLING_ACCESS_KEY!;
const SECRET_KEY = () => process.env.KLING_SECRET_KEY!;

// ─── JWT Generation ───

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function generateJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    iss: ACCESS_KEY(),
    iat: now - 5,
    exp: now + 1800, // 30 minutes
    nbf: now - 5,
  };

  const segments = [
    base64url(JSON.stringify(header)),
    base64url(JSON.stringify(payload)),
  ];

  const signature = createHmac("sha256", SECRET_KEY())
    .update(segments.join("."))
    .digest();

  segments.push(base64url(signature));
  return segments.join(".");
}

// ─── Types ───

export type VideoMode = "text2video" | "image2video" | "faceswap";

export interface KlingText2VideoRequest {
  prompt: string;
  negative_prompt?: string;
  cfg_scale?: number;
  duration?: "5" | "10";
  aspect_ratio?: "16:9" | "9:16" | "1:1";
  model_name?: string;
  image_url?: string; // Reference image for character consistency
}

export interface KlingImage2VideoRequest {
  image_url: string; // Source image to animate
  prompt?: string; // Motion prompt
  negative_prompt?: string;
  duration?: "5" | "10";
  aspect_ratio?: "16:9" | "9:16" | "1:1";
  model_name?: string;
  mode?: "std" | "pro";
}

export interface KlingFaceSwapRequest {
  source_face_url: string; // Character face image
  target_video_url: string; // Video to swap into
  model_name?: string;
}

export interface KlingTaskResponse {
  code: number;
  message: string;
  request_id: string;
  data: {
    task_id: string;
    task_status: "submitted" | "processing" | "succeed" | "failed";
    task_status_msg?: string;
    created_at: number;
    updated_at: number;
    task_result?: {
      videos: Array<{
        id: string;
        url: string;
        duration: string;
      }>;
    };
  };
}

export type KlingTaskStatus = KlingTaskResponse["data"]["task_status"];

// ─── API Client ───

async function klingFetch(path: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(`${BASE_URL()}/v1${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${generateJwt()}`,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Kling API error ${res.status}: ${body}`);
  }

  return res;
}

// ─── Text-to-Video ───

export async function submitText2Video(
  request: KlingText2VideoRequest
): Promise<string> {
  const body: Record<string, unknown> = {
    model_name: request.model_name ?? "kling-v2-master",
    prompt: request.prompt,
    duration: request.duration ?? "5",
    aspect_ratio: request.aspect_ratio ?? "16:9",
  };

  if (request.negative_prompt) body.negative_prompt = request.negative_prompt;
  if (request.cfg_scale) body.cfg_scale = request.cfg_scale;

  // Use image-to-video endpoint when a reference image is provided for style
  let endpoint = "/videos/text2video";
  if (request.image_url) {
    endpoint = "/videos/image2video";
    body.image = request.image_url;
    body.mode = "std";
  }

  const res = await klingFetch(endpoint, {
    method: "POST",
    body: JSON.stringify(body),
  });

  const data: KlingTaskResponse = await res.json();

  if (data.code !== 0) {
    throw new Error(`Kling submission failed: ${data.message}`);
  }

  return data.data.task_id;
}

// Backwards compatibility alias
export const submitVideoTask = submitText2Video;

// ─── Image-to-Video (Animate Image) ───

export async function submitImage2Video(
  request: KlingImage2VideoRequest
): Promise<string> {
  const body: Record<string, unknown> = {
    model_name: request.model_name ?? "kling-v2-master",
    image: request.image_url,
    duration: request.duration ?? "5",
    mode: request.mode ?? "std",
  };

  if (request.prompt) body.prompt = request.prompt;
  if (request.negative_prompt) body.negative_prompt = request.negative_prompt;
  if (request.aspect_ratio) body.aspect_ratio = request.aspect_ratio;

  const res = await klingFetch("/videos/image2video", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const data: KlingTaskResponse = await res.json();

  if (data.code !== 0) {
    throw new Error(`Kling submission failed: ${data.message}`);
  }

  return data.data.task_id;
}

// ─── Face Swap ───

export async function submitFaceSwap(
  request: KlingFaceSwapRequest
): Promise<string> {
  const body: Record<string, unknown> = {
    model_name: request.model_name ?? "kling-v2-master",
    source_face_image_url: request.source_face_url,
    target_video_url: request.target_video_url,
  };

  const res = await klingFetch("/videos/face-swap", {
    method: "POST",
    body: JSON.stringify(body),
  });

  const data: KlingTaskResponse = await res.json();

  if (data.code !== 0) {
    throw new Error(`Kling submission failed: ${data.message}`);
  }

  return data.data.task_id;
}

// ─── Task Status ───

export async function getTaskStatus(
  taskId: string,
  type: "text2video" | "image2video" | "face-swap" = "text2video"
): Promise<KlingTaskResponse["data"]> {
  const res = await klingFetch(`/videos/${type}/${taskId}`);
  const data: KlingTaskResponse = await res.json();

  if (data.code !== 0) {
    throw new Error(`Kling status check failed: ${data.message}`);
  }

  return data.data;
}

// ─── Download ───

export async function downloadVideo(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download video: ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
