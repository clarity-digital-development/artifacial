/**
 * Curated founding characters — a starter cast so new users can jump straight
 * into generation without first running the Character Creation flow.
 *
 * Each entry ships with a pre-generated portrait at
 * `/public/founding-characters/<slug>.webp` (640x853, 3:4 portrait). Cloning a
 * founding character into a user's library copies the metadata + reuses the
 * public image URL — no R2 storage cost per clone.
 *
 * To regenerate the images, run: `npx tsx scripts/generate-founding-characters.ts`
 */

export interface FoundingCharacter {
  /** Stable identifier — used in clone endpoint */
  slug: string;
  /** Display name */
  name: string;
  /** Short persona tag shown beneath the name on the card */
  persona: string;
  /** Description stored on the cloned Character row */
  description: string;
  /** Style label — must match Character.style values used by /characters/new */
  style: string;
  /**
   * Nano Banana Pro prompt used to generate the portrait image. Identity-locked
   * so the same character can be regenerated consistently.
   */
  generationPrompt: string;
}

const PORTRAIT_TAIL =
  "Three-quarter portrait, 3:4 aspect ratio, neutral gray studio backdrop, soft single-key softbox lighting from camera-right, sharp focus on the eyes, premium magazine-cover quality. Subject looking warmly toward camera with a relaxed natural expression.";

export const FOUNDING_CHARACTERS: FoundingCharacter[] = [
  {
    slug: "mia",
    name: "Mia",
    persona: "Lifestyle creator",
    description:
      "Late-20s brunette with shoulder-length wavy hair and warm brown eyes. Friendly, approachable lifestyle-content creator aesthetic. Wearing a soft cream knit sweater. Subtle freckles.",
    style: "realistic",
    generationPrompt: `A late-20s brunette woman with shoulder-length wavy chestnut hair, warm brown eyes, subtle freckles across her nose, wearing a soft cream knit sweater, gentle natural smile. ${PORTRAIT_TAIL}`,
  },
  {
    slug: "theo",
    name: "Theo",
    persona: "Urban streetwear",
    description:
      "Early-30s Latino man with short dark hair, warm tan skin, neatly trimmed beard, wearing a black oversized streetwear hoodie. Confident urban energy.",
    style: "realistic",
    generationPrompt: `An early-30s Latino man with short dark hair, warm tan skin, neatly trimmed dark beard, wearing a black oversized streetwear hoodie, calm confident expression. ${PORTRAIT_TAIL}`,
  },
  {
    slug: "aisha",
    name: "Aisha",
    persona: "Editorial fashion",
    description:
      "Mid-20s Black woman with elegant features, sleek long hair, deep brown eyes, wearing a tailored ivory blazer. High-fashion editorial energy.",
    style: "realistic",
    generationPrompt: `A mid-20s Black woman with elegant cheekbones, sleek long dark hair, deep brown eyes, wearing a tailored ivory blazer, composed editorial expression. ${PORTRAIT_TAIL}`,
  },
  {
    slug: "liam",
    name: "Liam",
    persona: "Lifestyle vlogger",
    description:
      "Mid-30s white man with scruffy short brown hair, hazel eyes, a few days of stubble, wearing a charcoal henley. Approachable lifestyle-vlogger vibe.",
    style: "realistic",
    generationPrompt: `A mid-30s white man with scruffy short brown hair, hazel eyes, a few days of stubble, wearing a charcoal henley, easy genuine smile. ${PORTRAIT_TAIL}`,
  },
  {
    slug: "sofia",
    name: "Sofia",
    persona: "Beauty influencer",
    description:
      "Mid-20s Latina woman with long wavy chocolate-brown hair, warm olive skin, subtle natural makeup, wearing a soft pink silk top. Vibrant beauty-influencer energy.",
    style: "realistic",
    generationPrompt: `A mid-20s Latina woman with long wavy chocolate-brown hair, warm olive skin, subtle natural makeup with rose-tinted lips, wearing a soft pink silk top, warm playful smile. ${PORTRAIT_TAIL}`,
  },
  {
    slug: "marcus",
    name: "Marcus",
    persona: "Executive professional",
    description:
      "Late-30s Black man with a clean fade, salt-and-pepper trim, wearing a slate-blue suit jacket over a white shirt. Confident executive presence.",
    style: "realistic",
    generationPrompt: `A late-30s Black man with a clean fade haircut featuring a hint of salt-and-pepper, wearing a slate-blue suit jacket over a crisp white shirt, calm confident expression. ${PORTRAIT_TAIL}`,
  },
  {
    slug: "yui",
    name: "Yui",
    persona: "Tech reviewer",
    description:
      "Late-20s East-Asian woman with chin-length straight black hair, almond eyes, wearing wireless earbuds and a minimal gray turtleneck. Smart tech-reviewer vibe.",
    style: "realistic",
    generationPrompt: `A late-20s East-Asian woman with chin-length straight black hair, almond brown eyes, wearing wireless earbuds and a minimalist gray turtleneck, intelligent thoughtful expression. ${PORTRAIT_TAIL}`,
  },
  {
    slug: "nora",
    name: "Nora",
    persona: "Wellness coach",
    description:
      "Early-30s Nordic blonde woman with long straight hair, light freckles, light blue eyes, wearing an athleisure quarter-zip in sage green. Wellness-coach energy.",
    style: "realistic",
    generationPrompt: `An early-30s Nordic blonde woman with long straight platinum hair, light freckles, light blue eyes, wearing an athleisure quarter-zip in sage green, serene calm smile. ${PORTRAIT_TAIL}`,
  },
  {
    slug: "diego",
    name: "Diego",
    persona: "Fitness creator",
    description:
      "Late-20s Latino man with short black hair, defined jawline, golden-tan skin, wearing a fitted black athletic compression top. Athletic-creator energy.",
    style: "realistic",
    generationPrompt: `A late-20s Latino man with short black hair, defined jawline, golden-tan skin, wearing a fitted black athletic compression top, focused athletic expression. ${PORTRAIT_TAIL}`,
  },
  {
    slug: "priya",
    name: "Priya",
    persona: "Foodie creator",
    description:
      "Mid-20s South-Asian woman with long wavy dark hair, warm brown skin, expressive almond eyes, wearing a mustard-yellow knit cardigan. Warm foodie-creator energy.",
    style: "realistic",
    generationPrompt: `A mid-20s South-Asian woman with long wavy dark hair, warm brown skin, expressive almond brown eyes, wearing a mustard-yellow knit cardigan, warm inviting smile. ${PORTRAIT_TAIL}`,
  },
  {
    slug: "felix",
    name: "Felix",
    persona: "Gen-Z gamer",
    description:
      "Early-20s white man with curly auburn hair, light freckles, green eyes, wearing a vintage band t-shirt and oversized headphones around his neck. Gen-Z gamer/streamer aesthetic.",
    style: "realistic",
    generationPrompt: `An early-20s white man with curly auburn hair, light freckles, green eyes, wearing a vintage black band t-shirt and oversized headphones around his neck, casual confident smirk. ${PORTRAIT_TAIL}`,
  },
  {
    slug: "zara",
    name: "Zara",
    persona: "Podcast host",
    description:
      "Early-30s mixed-race woman with curly natural hair, warm caramel skin, hazel eyes, wearing a black structured turtleneck. Founder / podcast-host gravitas.",
    style: "realistic",
    generationPrompt: `An early-30s mixed-race woman with curly natural shoulder-length hair, warm caramel skin, hazel eyes, wearing a black structured turtleneck, composed confident smile. ${PORTRAIT_TAIL}`,
  },
];

export function getFoundingCharacter(slug: string): FoundingCharacter | undefined {
  return FOUNDING_CHARACTERS.find((c) => c.slug === slug);
}

/** Public URL for the pre-generated portrait. Served from `/public`. */
export function foundingImageUrl(slug: string): string {
  return `/founding-characters/${slug}.webp`;
}
