/**
 * KIE.AI client for Kling 3.0 Motion Control.
 * Direct KIE.AI API integration — supports background_source and character_orientation
 * natively, which is not fully supported via PiAPI.
 *
 * API docs: https://docs.kie.ai/market/kling/motion-control-v3
 */

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
    body: JSON.stringify({ fileUrl }),
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
  mode?: "std" | "pro";        // std = 720p, pro = 1080p
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
  // Upload both files to KIE.AI hosting concurrently (external URLs expire)
  console.log(`[kieai] Uploading image + video to KIE.AI hosting...`);
  const [kieAiImageUrl, kieAiVideoUrl] = await Promise.all([
    uploadToKieAi(params.imageUrl),
    uploadToKieAi(params.videoUrl),
  ]);

  const mode = params.mode ?? "std";
  const orientation = params.characterOrientation ?? "video";
  const bgSource = params.backgroundSource ?? "input_video";

  console.log(`[kieai] Submitting motion-control: mode=${mode}, orientation=${orientation}, bgSource=${bgSource}`);

  const data = await kieAiFetch(`${KIEAI_BASE_URL}/api/v1/jobs/createTask`, {
    method: "POST",
    body: JSON.stringify({
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
    }),
  });

  const taskId = data.data?.taskId as string | undefined;
  if (!taskId) {
    throw new Error(`KIE.AI returned no taskId: ${JSON.stringify(data).slice(0, 300)}`);
  }

  console.log(`[kieai] Task submitted: taskId=${taskId}`);
  return { taskId };
}

// ─── Task Status ───

export type KieAiTaskStatus = "waiting" | "queuing" | "generating" | "success" | "fail";

export type KieAiTaskResult = {
  status: KieAiTaskStatus;
  videoUrl?: string;
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
  const state = task?.state as KieAiTaskStatus;

  let videoUrl: string | undefined;
  if (state === "success" && task.resultJson) {
    try {
      const result = JSON.parse(task.resultJson as string) as { resultUrls?: string[] };
      videoUrl = result.resultUrls?.[0];
    } catch {
      console.error(`[kieai] Failed to parse resultJson for task=${taskId}: ${task.resultJson}`);
    }
  }

  const errorMessage = (task?.failMsg as string) || undefined;

  return {
    status: state,
    videoUrl,
    errorMessage: errorMessage || undefined,
    progress: task?.progress as number | undefined,
  };
}
