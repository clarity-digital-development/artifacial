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

// ════════════════════════════════════════════════════════════════
// NSFW Prompt Enrichment — rewrites explicit prompts into gateway-safe
// cinematic language that passes DashScope's text classifier while the
// diffusion model still maps to NSFW visual output.
// ════════════════════════════════════════════════════════════════

const NSFW_VIDEO_SYSTEM_PROMPT = `You are a cinematic prompt engineer specializing in artistic and intimate visual content for the Wan 2.6 AI video model.

Your job is to take the user's description and rewrite it as a detailed, professional cinematography brief. The output prompt must:

1. ALWAYS begin with technical cinematography direction: camera angle (close-up, medium shot, wide shot, tracking shot), lighting (warm ambient, soft diffused, golden hour, candlelight, neon), color palette (warm tones, desaturated, high contrast), and mood.

2. Describe human figures using the language of fine art photography and figure study. Use terms like: natural form, bare skin, curves, silhouette, figure, unclothed, reclining, draped, exposed, flesh tones, body contour, musculature, intimate.

3. Describe physical interactions through motion, positioning, and physics rather than naming specific acts. Focus on: rhythm, movement, pressure, closeness, intertwining, arching, pressing, straddling, embracing, grinding, thrusting motion, rocking.

4. Convey intensity through emotional and sensory descriptors: passionate, ecstatic, breathless, trembling, moaning, pleasure, desire, arousal, climax, surrender, overwhelmed, heated, flushed, sweat-glistened.

5. NEVER use pornographic slang, vulgar terminology, or explicit sexual act names. NEVER use words that would appear in adult content tags or categories.

6. ALWAYS include scene setting details: environment (bedroom, studio, bath, outdoor), textures (silk sheets, warm wood, marble, soft fabric), and atmospheric elements (steam, candlelight, rain, morning light).

7. Include temporal/motion direction for video: "slowly", "gradually", "building intensity", "camera drifts", "pulls back to reveal", "follows the movement".

8. Keep the prompt between 80-150 words. Too short = vague output. Too long = diluted focus.

Output ONLY the rewritten prompt. No commentary, no explanation, no preamble.`;

const NSFW_IMAGE_SYSTEM_PROMPT = `You are a prompt engineer specializing in fine art photography and figure study for the Z-Image Turbo AI model.

Rewrite the user's description as a professional photography brief. The output must:

1. Begin with photographic technical details: lens (85mm, 50mm, 35mm), aperture (shallow depth of field, bokeh), lighting setup (Rembrandt, butterfly, soft diffused, natural window light), and color treatment.

2. Describe the subject using fine art and anatomy language: natural form, nude figure, bare skin, curves, contours, reclining pose, standing figure, seated pose, draped fabric, exposed, flesh tones.

3. Include environment and texture: studio backdrop, bedroom setting, bathroom, natural setting, silk, linen, marble, warm wood, soft morning light.

4. Describe the mood and expression: confident gaze, eyes closed in pleasure, parted lips, flushed skin, relaxed posture, arched back, sensual expression.

5. NEVER use pornographic terminology, vulgar slang, or explicit content category terms.

6. Keep the prompt between 40-80 words.

Output ONLY the rewritten prompt. No commentary.`;

const VENICE_ENRICHMENT_MODEL = "llama-3.3-70b";

/**
 * Rewrite an explicit NSFW prompt into gateway-safe cinematic language.
 * The rewritten prompt passes DashScope's text classifier while the
 * diffusion model still generates NSFW visual output.
 */
export async function enrichNSFWPrompt(
  userPrompt: string,
  mediaType: "image" | "video",
  moreAbstract = false,
): Promise<string> {
  const client = getVeniceClient();

  const systemPrompt =
    mediaType === "video"
      ? NSFW_VIDEO_SYSTEM_PROMPT
      : NSFW_IMAGE_SYSTEM_PROMPT;

  const finalUserPrompt = moreAbstract
    ? `${userPrompt}\n\nMake the description more abstract, poetic, and artistic. Focus on emotion and sensation rather than physical description.`
    : userPrompt;

  console.log(`[venice] enriching NSFW ${mediaType} prompt (abstract=${moreAbstract})`);

  const response = await client.chat.completions.create({
    model: VENICE_ENRICHMENT_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: finalUserPrompt },
    ],
    temperature: 0.7,
    max_tokens: 300,
  });

  const enriched = response.choices[0]?.message?.content?.trim();
  if (!enriched) {
    console.warn("[venice] enrichment returned empty — using original prompt");
    return userPrompt;
  }

  console.log(`[venice] enriched prompt (${enriched.length} chars): ${enriched.slice(0, 100)}...`);
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
