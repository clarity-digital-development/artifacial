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

// ─── Deterministic proper-noun name detector ────────────────────────────────
//
// Replaces the noisy LLM realPersonReference flag. We only block when a real
// proper-noun name appears in the prompt — generic descriptions like
// "tall blonde woman in a red dress" are NOT a match. Allows creators to
// generate real-person-likeness content as long as no specific name is used.

// Common two-word concept/place names that look like person names but aren't.
// These pass straight through.
const NON_PERSON_PAIRS = new Set([
  "New York", "New Orleans", "New Jersey", "New Mexico", "New Hampshire",
  "Los Angeles", "San Francisco", "San Diego", "San Antonio", "San Jose",
  "Las Vegas", "South Beach", "South Africa", "South Korea", "North Korea",
  "Hong Kong", "United States", "United Kingdom",
  "Lake Tahoe", "Lake Como", "Mount Everest", "Mount Rushmore",
  "Wall Street", "Times Square", "Central Park", "Hyde Park",
  "Mona Lisa", "Eiffel Tower", "Statue Liberty",
  "Big Apple", "Big Sur", "Big Ben",
  "Bay Area", "Silicon Valley", "Death Valley",
  "Studio Ghibli", "Pixar Studios", "Marvel Studios",
]);

// Title prefixes that very reliably introduce a real-person reference.
const TITLE_NAME_RE =
  /\b(?:President|Vice\s*President|Prime\s*Minister|Senator|Congressman|Congresswoman|Mayor|Governor|Prince|Princess|King|Queen|Pope|Sir|Lord|Lady|Dr\.?|Mr\.?|Mrs\.?|Ms\.?|Miss)\s+[A-Z][a-zA-Z'\-]+(?:\s+[A-Z][a-zA-Z'\-]+)?/g;

// A short curated list of high-risk celebrity/public-figure names that
// likeness-generation attempts most commonly target. Matched case-insensitively.
const CELEBRITY_NAMES = [
  // Music
  "Taylor Swift", "Selena Gomez", "Ariana Grande", "Beyonce", "Beyoncé",
  "Rihanna", "Lady Gaga", "Billie Eilish", "Olivia Rodrigo", "Dua Lipa",
  "Justin Bieber", "Drake", "Kanye West", "Ye Ye", "Travis Scott",
  "Sabrina Carpenter", "Doja Cat", "SZA", "Megan Thee Stallion", "Cardi B",
  "Nicki Minaj", "Bad Bunny", "The Weeknd", "Post Malone", "Ed Sheeran",
  // Film/TV
  "Scarlett Johansson", "Margot Robbie", "Emma Watson", "Emma Stone",
  "Jennifer Lawrence", "Gal Gadot", "Zendaya", "Sydney Sweeney",
  "Anya Taylor", "Florence Pugh", "Millie Bobby", "Jenna Ortega",
  "Tom Cruise", "Brad Pitt", "Leonardo DiCaprio", "Ryan Reynolds",
  "Ryan Gosling", "Timothée Chalamet", "Timothee Chalamet", "Chris Evans",
  "Chris Hemsworth", "Tom Holland", "Robert Downey", "Henry Cavill",
  // Reality / social
  "Kim Kardashian", "Kylie Jenner", "Kendall Jenner", "Khloe Kardashian",
  "Kourtney Kardashian", "Bella Hadid", "Gigi Hadid", "Hailey Bieber",
  "Addison Rae", "Charli D'Amelio", "Bhad Bhabie",
  // Tech / politics
  "Elon Musk", "Mark Zuckerberg", "Jeff Bezos", "Bill Gates", "Steve Jobs",
  "Sam Altman", "Sundar Pichai", "Tim Cook",
  "Donald Trump", "Joe Biden", "Barack Obama", "Michelle Obama",
  "Kamala Harris", "Hillary Clinton", "Bernie Sanders", "Ron DeSantis",
  "Vladimir Putin", "Xi Jinping",
  // Sports
  "LeBron James", "Michael Jordan", "Stephen Curry", "Lionel Messi",
  "Cristiano Ronaldo", "Serena Williams", "Tom Brady", "Patrick Mahomes",
];

const CELEBRITY_RE = new RegExp(
  "\\b(?:" + CELEBRITY_NAMES.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")\\b",
  "i"
);

export function detectExplicitPersonName(prompt: string): {
  found: boolean;
  matches: string[];
} {
  const matches: string[] = [];

  // 1. Celebrity allow-list — high precision
  const celebMatch = prompt.match(CELEBRITY_RE);
  if (celebMatch) matches.push(celebMatch[0]);

  // 2. Title + capitalized name (high precision)
  const titleMatches = prompt.match(TITLE_NAME_RE);
  if (titleMatches) matches.push(...titleMatches);

  // 3. Two-or-more consecutive capitalized words (likely FirstName LastName)
  //    Filtered against the NON_PERSON_PAIRS set so places/brands don't trip.
  const properPairs = prompt.match(/\b[A-Z][a-zA-Z'\-]+\s+[A-Z][a-zA-Z'\-]+\b/g) ?? [];
  for (const pair of properPairs) {
    if (!NON_PERSON_PAIRS.has(pair) && !matches.some((m) => m.includes(pair))) {
      matches.push(pair);
    }
  }

  return { found: matches.length > 0, matches };
}
