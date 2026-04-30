// ─── User-Facing Error Sanitization ─────────────────────────────────────────
//
// Every error message that crosses from server → client passes through
// `sanitizeClientError`. The raw input is always logged (so it's preserved in
// Railway deploy logs), and the returned string is a clean, generic message
// safe to show to end users.
//
// Two bands of behavior:
//   - User-friendly canonical messages ("Not enough credits", "Generation
//     failed", etc.) pass through unchanged after a provider-name strip.
//   - Anything else (raw provider blobs, JSON dumps, HTTP error codes,
//     mention of upstream vendors) is replaced with a generic fallback.

export const FALLBACK_GENERIC =
  "Generation failed due to a temporary provider issue. Credits refunded.";

export const FALLBACK_RATE_LIMIT =
  "We're being rate-limited by the provider. Please try again in a few minutes. Credits refunded.";

export const FALLBACK_TIMEOUT =
  "Generation timed out before the provider could start. Credits refunded.";

const RATE_LIMIT_HINTS: RegExp[] = [
  /\btoo many requests\b/i,
  /\brate limit/i,
  /\b429\b/,
  /\berrorCode\s*=?\s*10001\b/,
];

const TIMEOUT_HINTS: RegExp[] = [
  /\btimed?\s*out\b/i,
  /\btimeout\b/i,
  /\btask\s+timed\s+out\b/i,
];

const RAW_HEURISTICS: RegExp[] = [
  /\{[\s\S]*"(task_id|task_type|queue_id|webhook_config|model_router)"/i,
  /\{[\s\S]*"code"\s*:\s*\d{3,}/i,
  /HTTP\s+(4|5)\d{2}/i,
  /\b(4|5)\d{2}:\s*\{/,
  /\bpreprocess request\b/i,
  /generation failed:.*\{/i,
  /\bAPIError\b/i,
  /\bError\s+code\s*=?\s*\d{4,}/i,
];

const USER_FRIENDLY_PREFIXES: RegExp[] = [
  /^Generation /i,
  /^Cancelled by user/i,
  /^(Not enough|Insufficient) credits/i,
  /^Prompt /i,
  /^This (prompt|model|tool) /i,
  /^Your .* plan /i,
  /^Content blocked/i,
  /^Invalid /i,
  /^Unknown model/i,
  /^Missing /i,
  /^Account deleted/i,
  /^ACCOUNT_DELETED/i,
  /^Failed to check /i,
  /^Legacy generation/i,
  /^NSFW /i,
  /^Refund: /i,
];

const PROVIDER_TEST = /\b(PiAPI|PI\s*API|KIE\.?AI|KIE|Venice|fal\.ai|fal-ai|DashScope|MiniMax|ElevenLabs|piapi|kieai)\b/i;
const PROVIDER_STRIP = /\b(PiAPI|PI\s*API|KIE\.?AI|KIE|Venice|fal\.ai|fal-ai|DashScope|MiniMax|ElevenLabs|piapi|kieai)\b/gi;

function stripProviderNames(text: string): string {
  return text
    .replace(PROVIDER_STRIP, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Convert any raw error string into something safe to display to a user.
 * The raw value is always echoed to console.error with a context tag so
 * Railway logs retain full diagnostic detail.
 */
export function sanitizeClientError(
  raw: string | null | undefined,
  context: string = "error",
): string {
  if (!raw || typeof raw !== "string" || !raw.trim()) {
    return "Generation failed. Please try again.";
  }

  // Preserve full raw error in Railway deploy logs
  console.error(`[client-error:${context}] raw=${JSON.stringify(raw)}`);

  // Specific friendly variants for common upstream conditions
  if (RATE_LIMIT_HINTS.some((re) => re.test(raw))) return FALLBACK_RATE_LIMIT;
  if (TIMEOUT_HINTS.some((re) => re.test(raw))) return FALLBACK_TIMEOUT;

  // Raw provider blob? Always replace.
  if (RAW_HEURISTICS.some((re) => re.test(raw))) {
    return FALLBACK_GENERIC;
  }

  // Provider name embedded in a non-canonical message? Replace.
  if (PROVIDER_TEST.test(raw) && !USER_FRIENDLY_PREFIXES.some((re) => re.test(raw))) {
    return FALLBACK_GENERIC;
  }

  // Canonical user-friendly message — strip any provider tokens and pass through.
  if (USER_FRIENDLY_PREFIXES.some((re) => re.test(raw))) {
    const cleaned = stripProviderNames(raw);
    return cleaned.length >= 5 ? cleaned : FALLBACK_GENERIC;
  }

  // Unknown shape — be conservative.
  return FALLBACK_GENERIC;
}
