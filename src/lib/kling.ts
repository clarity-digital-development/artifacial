// Kling 2.6 Video Generation API client
// Phase 1: Single video generation per project

const BASE_URL = () => process.env.KLING_API_BASE_URL ?? "https://api.klingai.com";
const API_KEY = () => process.env.KLING_API_KEY!;

// ─── Types ───

export interface KlingSubmitRequest {
  prompt: string;
  negative_prompt?: string;
  cfg_scale?: number;
  duration?: "5" | "10";
  aspect_ratio?: "16:9" | "9:16" | "1:1";
  model_name?: string;
  image_url?: string; // Reference image for character consistency
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
      Authorization: `Bearer ${API_KEY()}`,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Kling API error ${res.status}: ${body}`);
  }

  return res;
}

export async function submitVideoTask(
  request: KlingSubmitRequest
): Promise<string> {
  const body: Record<string, unknown> = {
    model_name: request.model_name ?? "kling-v2.6",
    prompt: request.prompt,
    duration: request.duration ?? "5",
    aspect_ratio: request.aspect_ratio ?? "16:9",
  };

  if (request.negative_prompt) body.negative_prompt = request.negative_prompt;
  if (request.cfg_scale) body.cfg_scale = request.cfg_scale;

  // Use image-to-video endpoint when a reference image is provided
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

export async function getTaskStatus(
  taskId: string,
  type: "text2video" | "image2video" = "text2video"
): Promise<KlingTaskResponse["data"]> {
  const res = await klingFetch(`/videos/${type}/${taskId}`);
  const data: KlingTaskResponse = await res.json();

  if (data.code !== 0) {
    throw new Error(`Kling status check failed: ${data.message}`);
  }

  return data.data;
}

export async function downloadVideo(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download video: ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
