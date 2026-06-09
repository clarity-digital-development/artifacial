/**
 * Provider router — chooses the cheapest viable upstream for a generation
 * request, with automatic failover to a secondary provider on error.
 *
 * v1 covers ONE model family: Kling 3.0 Omni Video. This is our most-used
 * model (15+ viral presets, Marketing Studio, AI Hug variants) and the
 * KIE.AI overlap saves ~30% per generation:
 *
 *   PiAPI Kling 3.0 omni 720p:   $0.10/s × 5s = $0.50  per gen
 *   KIE.AI kling-3.0/video std:  $0.07/s × 5s = $0.35  per gen
 *   Savings:                                    $0.15  (~30% margin lift)
 *
 * At 2,000 cr selling price (75% margin baseline), KIE routes push effective
 * margin to ~82.5%. On the 24 preset-* tools that all use Kling 3.0 omni at
 * 720p 5s, this is meaningful.
 *
 * Policy:
 *   - If KIE_AI_API_KEY is set AND KIE_AI_DISABLED is not "1" → try KIE first
 *   - On KIE error (network / 5xx / non-recoverable parse), fall back to PiAPI
 *   - Telemetry-tag every submission via the `provider` field returned alongside
 *     the taskId so we can audit which provider served which job
 *
 * Future expansion (gated on production telemetry):
 *   - Seedance 2: PiAPI $0.10/s @ 480p vs KIE $0.057–$0.095/s — 5–43% savings
 *   - Veo 3.1: huge savings (60–95% off official prices via KIE)
 */

import { submitTask, type PiAPISubmitResult } from "@/lib/piapi-client";
import { submitKling3OmniVideo } from "@/lib/kieai";

const APP_URL_FALLBACK = "https://artifacial.app";

export type RoutedProvider = "kieai" | "piapi";

export interface RouteResult {
  /** TaskId — prefixed with `kieai:video:` when KIE served the request, raw when PiAPI did. */
  taskId: string;
  /** Which provider actually fulfilled the request, for inputParams telemetry. */
  provider: RoutedProvider;
  /** Set when the primary provider errored and we fell back. */
  fallbackReason?: string;
}

export interface Kling3OmniInput {
  prompt: string;
  /** 1 or 2 reference images — start/end frames */
  images: string[];
  durationSeconds: 5 | 10;
  aspectRatio: "9:16" | "16:9" | "1:1";
  resolution: "720p" | "1080p" | "4K";
  withAudio?: boolean;
}

/**
 * Submit a Kling 3.0 Omni Video request via the preferred provider with
 * automatic PiAPI failover. Returns the prefixed taskId that the existing
 * poll route already knows how to dispatch.
 */
export async function submitKling3OmniRouted(input: Kling3OmniInput): Promise<RouteResult> {
  // KIE.AI Kling 3.0 routing is OPT-IN — set KIE_AI_KLING_ROUTING="1" in env
  // to enable. Default behavior preserves the original PiAPI-direct path so
  // existing workshop presets + Marketing Studio keep working unchanged. The
  // routing plumbing is in place; flip the flag when KIE.AI Kling integration
  // has been validated against real submissions in production.
  const hasKieKey = !!process.env.KIE_AI_API_KEY;
  const optedIn = process.env.KIE_AI_KLING_ROUTING === "1";
  const tryKieFirst = hasKieKey && optedIn;

  // ── Primary: KIE.AI ──
  if (tryKieFirst) {
    try {
      const callbackUrl = `${process.env.APP_URL ?? APP_URL_FALLBACK}/api/webhooks/kieai`;
      const { taskId } = await submitKling3OmniVideo({
        prompt: input.prompt,
        imageUrls: input.images,
        durationSeconds: input.durationSeconds,
        aspectRatio: input.aspectRatio,
        resolution: input.resolution,
        withAudio: input.withAudio,
        callbackUrl,
      });
      console.log(`[router] kling-3-omni → kieai (taskId=${taskId})`);
      return { taskId: `kieai:video:${taskId}`, provider: "kieai" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[router] kling-3-omni KIE.AI failed, falling back to PiAPI: ${msg}`);
      return submitPiapiFallback(input, `kieai-error: ${msg.slice(0, 200)}`);
    }
  }

  // ── No KIE → straight to PiAPI ──
  return submitPiapiFallback(input);
}

async function submitPiapiFallback(input: Kling3OmniInput, fallbackReason?: string): Promise<RouteResult> {
  // PiAPI Kling 3.0 omni uses lowercase resolution + numeric duration
  const piapiInput: Record<string, unknown> = {
    prompt: input.prompt,
    images: input.images,
    duration: input.durationSeconds,
    aspect_ratio: input.aspectRatio,
    resolution: input.resolution.toLowerCase(),
    version: "3.0",
  };
  const result: PiAPISubmitResult = await submitTask("kling", "omni_video_generation", piapiInput);
  console.log(`[router] kling-3-omni → piapi (taskId=${result.taskId})${fallbackReason ? ` [${fallbackReason}]` : ""}`);
  return {
    taskId: result.taskId,
    provider: "piapi",
    ...(fallbackReason ? { fallbackReason } : {}),
  };
}

/**
 * Best-effort matcher: detect when a workshop `buildTask` result is a Kling 3.0
 * Omni request that the router can intercept. Returns `null` if the request
 * doesn't match — caller should fall back to the default `submitTask` flow.
 */
export function detectKling3Omni(
  task: { model: string; taskType: string; input: Record<string, unknown> },
): Kling3OmniInput | null {
  if (task.model !== "kling" || task.taskType !== "omni_video_generation") return null;
  const i = task.input;
  if (i.version !== "3.0") return null;
  const images = Array.isArray(i.images) ? (i.images.filter((u): u is string => typeof u === "string")) : [];
  if (images.length === 0) return null;
  const duration = Number(i.duration);
  if (duration !== 5 && duration !== 10) return null;
  const aspectRatio = typeof i.aspect_ratio === "string" ? i.aspect_ratio : "9:16";
  if (aspectRatio !== "9:16" && aspectRatio !== "16:9" && aspectRatio !== "1:1") return null;
  const rawRes = typeof i.resolution === "string" ? i.resolution.toLowerCase() : "720p";
  const resolution = rawRes === "1080p" ? "1080p" : rawRes === "4k" ? "4K" : "720p";
  return {
    prompt: typeof i.prompt === "string" ? i.prompt : "",
    images,
    durationSeconds: duration as 5 | 10,
    aspectRatio,
    resolution,
    withAudio: false,
  };
}
