/**
 * Layer 1: Pre-enrichment keyword/pattern filter.
 *
 * Runs server-side before the prompt hits Venice AI.
 * Catches obvious CSAM, extreme illegal content, and non-consent terms
 * without needing an API call. Fast, deterministic, zero cost.
 *
 * This is NOT a replacement for LLM classification — it's a fast pre-filter
 * that catches the worst offenders before they ever reach an external API.
 */

export type KeywordFilterResult = {
  blocked: boolean;
  reason?: string;
  matchedPattern?: string;
};

// ─── Pattern categories ───

/** CSAM / child exploitation — always hard block */
const CSAM_PATTERNS = [
  /\b(?:child|kid|toddler|infant|baby|preteen|pre-teen)\b.*\b(?:sex|nude|naked|erotic|porn|explicit|undress)/i,
  /\b(?:sex|nude|naked|erotic|porn|explicit|undress).*\b(?:child|kid|toddler|infant|baby|preteen|pre-teen)\b/i,
  /\b(?:pedo|paedo|pedophil|paedophil|cp\b|child\s*porn)/i,
  /\bloli\b|\bshota\b|\blolicon\b|\bshotacon\b/i,
  /\bminor[s]?\b.*\b(?:sex|nude|naked|erotic|explicit)/i,
  /\b(?:sex|nude|naked|erotic|explicit).*\bminor[s]?\b/i,
  /\bunder\s*(?:age|aged)\b.*\b(?:sex|nude|naked|erotic)/i,
  /\bschool\s*girl\b.*\b(?:sex|nude|naked|erotic|strip|undress)/i,
  /\bschool\s*boy\b.*\b(?:sex|nude|naked|erotic|strip|undress)/i,
];

/** Non-consent / sexual violence — always hard block */
const NON_CONSENT_PATTERNS = [
  /\b(?:rape|raping|raped)\b/i,
  /\bforced\s+(?:sex|intercourse|penetration|oral)\b/i,
  /\bsexual\s+(?:assault|abuse)\b/i,
  /\bnon[\s-]*consent/i,
  /\bdrugged\b.*\b(?:sex|rape|assault)/i,
  /\b(?:sex|rape|assault).*\bdrugged\b/i,
];

/** Extreme illegal content — always hard block */
const ILLEGAL_PATTERNS = [
  /\b(?:snuff|snuff\s*film)\b/i,
  /\b(?:bestiality|zoophilia)\b/i,
  /\b(?:necrophilia|necro)\b/i,
  /\bhow\s+to\s+(?:make|build|construct)\s+(?:a\s+)?(?:bomb|explosive|weapon)/i,
  /\b(?:terrorism|terrorist)\s+(?:attack|plot|plan)\b/i,
];

/** Real person exploitation — block */
const REAL_PERSON_DEEPFAKE_PATTERNS = [
  /\b(?:deepfake|deep\s*fake)\b/i,
  /\brevenge\s*porn\b/i,
];

const ALL_PATTERNS: Array<{ patterns: RegExp[]; reason: string }> = [
  { patterns: CSAM_PATTERNS, reason: "CSAM: Content involving minors is strictly prohibited" },
  { patterns: NON_CONSENT_PATTERNS, reason: "Non-consensual sexual content is prohibited" },
  { patterns: ILLEGAL_PATTERNS, reason: "Illegal or extreme content is prohibited" },
  { patterns: REAL_PERSON_DEEPFAKE_PATTERNS, reason: "Deepfake/revenge porn content is prohibited" },
];

/**
 * Fast keyword/pattern check. Returns immediately — no API calls.
 * Should be called BEFORE sending prompts to Venice or any external service.
 */
export function filterPromptKeywords(prompt: string): KeywordFilterResult {
  const normalized = prompt.toLowerCase();

  for (const category of ALL_PATTERNS) {
    for (const pattern of category.patterns) {
      if (pattern.test(normalized)) {
        return {
          blocked: true,
          reason: category.reason,
          matchedPattern: pattern.source,
        };
      }
    }
  }

  return { blocked: false };
}
