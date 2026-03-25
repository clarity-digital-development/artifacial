// Venice AI client — OpenAI-compatible API for prompt enrichment + classification
// Replaces Anthropic/Haiku for both SFW and NSFW prompt processing

import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getVeniceClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.VENICE_API_KEY!,
      baseURL: "https://api.venice.ai/api/v1",
    });
  }
  return _client;
}

export const VENICE_MODEL = "llama-3.3-70b";
export const VENICE_UNCENSORED_MODEL = "venice-uncensored";

// ════════════════════════════════════════════════════════════════
// NSFW Prompt Enrichment — rewrites explicit prompts to bypass
// DashScope's text classifier while preserving visual intent.
// ════════════════════════════════════════════════════════════════

/**
 * Rewrite an explicit NSFW prompt to avoid explicit keywords
 * while preserving the visual intent for the diffusion model.
 */
export async function enrichNSFWPrompt(
  userPrompt: string,
  _mediaType: "image" | "video",
  moreAbstract = false,
): Promise<string> {
  const client = getVeniceClient();

  let instruction = "Rewrite this prompt in a way that avoids explicit keywords while preserving the visual intent. Output ONLY the rewritten prompt, nothing else.";
  if (moreAbstract) {
    instruction = "Rewrite this prompt in a way that avoids explicit keywords while preserving the visual intent. Make it more abstract and poetic. Output ONLY the rewritten prompt, nothing else.";
  }

  console.log(`[venice] enriching NSFW prompt (abstract=${moreAbstract}, model=${VENICE_MODEL})`);
  console.log(`[venice] original prompt: "${userPrompt}"`);

  const response = await client.chat.completions.create({
    model: VENICE_UNCENSORED_MODEL,
    messages: [
      { role: "system", content: instruction },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 500,
  });

  const enriched = response.choices[0]?.message?.content?.trim();
  if (!enriched) {
    throw new Error("Venice enrichment returned empty response");
  }

  console.log(`[venice] enriched prompt: "${enriched}"`);
  return enriched;
}

// ════════════════════════════════════════════════════════════════
// Venice Video Generation API (separate from OpenAI-compatible text API)
// Docs: POST /api/v1/video/queue (submit), POST /api/v1/video/retrieve (poll)
// ════════════════════════════════════════════════════════════════

const VENICE_VIDEO_BASE = "https://api.venice.ai/api/v1/video";

function getVeniceApiKey(): string {
  const key = process.env.VENICE_API_KEY;
  if (!key) throw new Error("VENICE_API_KEY environment variable is not set");
  return key;
}

// ─── Types ───

export type VeniceVideoSubmitParams = {
  model: string;
  prompt: string;
  duration: string; // "5s", "10s", "15s"
  resolution?: string; // "1080p", "720p", "480p"
  aspectRatio?: string;
  audio?: boolean;
  imageUrl?: string;
  negativePrompt?: string;
  endImageUrl?: string;
};

export type VeniceVideoSubmitResult = {
  queueId: string;
  model: string;
};

export type VeniceVideoRetrieveResult = {
  status: "processing" | "completed" | "failed";
  videoBuffer?: Buffer;
  contentType?: string;
  averageExecutionTime?: number;
  executionDuration?: number;
  errorMessage?: string;
};

// ─── Submit Video ───

export async function submitVeniceVideo(
  params: VeniceVideoSubmitParams
): Promise<VeniceVideoSubmitResult> {
  const body: Record<string, unknown> = {
    model: params.model,
    prompt: params.prompt,
    duration: params.duration,
  };

  if (params.resolution) body.resolution = params.resolution;
  if (params.aspectRatio) body.aspect_ratio = params.aspectRatio;
  if (params.audio !== undefined) body.audio = params.audio;
  if (params.imageUrl) body.image_url = params.imageUrl;
  if (params.negativePrompt) body.negative_prompt = params.negativePrompt;
  if (params.endImageUrl) body.end_image_url = params.endImageUrl;

  console.log(
    `[venice] submit: model=${params.model}, duration=${params.duration}, resolution=${params.resolution || "720p"}`
  );

  const res = await fetch(`${VENICE_VIDEO_BASE}/queue`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getVeniceApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Venice submit ${res.status}: ${errorBody}`);
  }

  const data = await res.json();
  const queueId = data.queue_id;
  if (!queueId) {
    throw new Error(
      `Venice submit failed: no queue_id in response: ${JSON.stringify(data)}`
    );
  }

  console.log(`[venice] queued: queue_id=${queueId}, model=${data.model || params.model}`);

  return {
    queueId,
    model: data.model || params.model,
  };
}

// ─── Retrieve / Poll Video ───

/**
 * Poll Venice for video generation status.
 *
 * The retrieve endpoint returns:
 * - application/json with status info when still processing
 * - video/mp4 binary when completed
 * - 404 = expired/not found
 * - 422 = content policy violation
 * - 500 = generation failed
 * - 503 = capacity issues
 */
export async function retrieveVeniceVideo(
  model: string,
  queueId: string
): Promise<VeniceVideoRetrieveResult> {
  const res = await fetch(`${VENICE_VIDEO_BASE}/retrieve`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getVeniceApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, queue_id: queueId }),
  });

  // Error status codes → failed
  if (res.status === 404) {
    return {
      status: "failed",
      errorMessage: "Generation expired or not found (404)",
    };
  }
  if (res.status === 422) {
    return {
      status: "failed",
      errorMessage: "Blocked by Venice content policy (422)",
    };
  }
  if (res.status === 500) {
    return {
      status: "failed",
      errorMessage: "Venice generation failed (500)",
    };
  }
  if (res.status === 503) {
    return {
      status: "processing",
      errorMessage: "Venice at capacity, retrying (503)",
    };
  }
  if (!res.ok) {
    const errorBody = await res.text();
    return {
      status: "failed",
      errorMessage: `Venice retrieve ${res.status}: ${errorBody}`,
    };
  }

  // Check content type to determine if completed or still processing
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    // Still processing — parse JSON status
    const data = await res.json();

    const modelRouter = res.headers.get("x-venice-model-router");
    console.log(
      `[venice] poll: queue_id=${queueId} status=${data.status} exec_duration=${data.execution_duration || 0}ms avg=${data.average_execution_time || 0}ms model-router=${modelRouter || "none"}`
    );

    return {
      status: "processing",
      averageExecutionTime: data.average_execution_time,
      executionDuration: data.execution_duration,
    };
  }

  if (
    contentType.includes("video/") ||
    contentType.includes("application/octet-stream")
  ) {
    // Completed — response body is the video binary
    const buffer = Buffer.from(await res.arrayBuffer());

    // Log the model router header — reveals Venice's upstream provider
    const modelRouter = res.headers.get("x-venice-model-router");
    console.log(
      `[venice] completed: queue_id=${queueId} size=${buffer.length} bytes, content-type=${contentType}, model-router=${modelRouter || "none"}`
    );

    return {
      status: "completed",
      videoBuffer: buffer,
      contentType,
    };
  }

  // Unexpected content type — try to parse as JSON fallback
  try {
    const data = await res.json();
    return {
      status: "processing",
      averageExecutionTime: data.average_execution_time,
      executionDuration: data.execution_duration,
    };
  } catch {
    return {
      status: "failed",
      errorMessage: `Unexpected content-type from Venice: ${contentType}`,
    };
  }
}
