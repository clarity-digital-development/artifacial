/**
 * Claude-powered ad-script writer for Marketing Studio.
 *
 * Takes a scraped product + mode and returns:
 *  - A direct-to-camera spoken script (~12-15 seconds)
 *  - A visual scene description used as the Kling 3.0 Omni prompt
 *  - A 1-sentence hook for the result-page title
 *
 * Mirrors the virality.ts pattern: module-scope system prompt with
 * cache_control: ephemeral, claude-sonnet-4-6, JSON-only return contract,
 * regex+JSON.parse extraction, defensive normalization.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { ProductInfo } from "./scraper";

export type MarketingMode = "ugc" | "tv-spot" | "hyper-motion";

export interface AdScript {
  /** Hook headline shown above the result video — ~6 words */
  hook: string;
  /** Direct-to-camera spoken script — 12-15 seconds, conversational */
  spokenScript: string;
  /** Scene-direction prompt fed to Kling 3.0 Omni alongside character + product images */
  scenePrompt: string;
  /** Which mode produced this script, echoed back for telemetry */
  mode: MarketingMode;
}

const MODE_PROFILES: Record<MarketingMode, { vibe: string; format: string; tail: string }> = {
  ugc: {
    vibe:
      "casual, authentic creator-style — like a real person filming with their phone in their kitchen. Slightly informal. Excited but not theatrical.",
    format:
      "Direct-to-camera handheld phone video. Natural lighting from a window. Subtle handheld shake. Creator-energy, NOT cinematic. Aspect ratio 9:16.",
    tail:
      "Authentic UGC iPhone-style, soft window lighting, casual home or office setting, genuine emotional reaction, phone-quality realism (NOT cinematic). Direct-to-camera framing typical of viral TikTok creator content.",
  },
  "tv-spot": {
    vibe:
      "polished, confident, brand-led. The kind of script a $30M Super Bowl ad would deliver in 15 seconds. Aspirational, never apologetic.",
    format:
      "Cinematic 16:9 commercial. Premium cinematography. Director-of-photography lighting. Slow tasteful camera moves. Aspirational tone.",
    tail:
      "Cinematic premium commercial photography, dramatic key + fill lighting, shallow depth of field, polished color grading, slow tasteful camera move toward the product, aspirational brand-led aesthetic. 16:9 cinema framing.",
  },
  "hyper-motion": {
    vibe:
      "no spoken script needed — this is a product-hero CGI moment. The 'spokenScript' field should be a 1-2-word brand tagline or product name only.",
    format:
      "CGI product-hero shot. The product is the protagonist. Physics-driven camera move (orbit, dolly-in, snap-zoom). Studio environment. No human dialogue.",
    tail:
      "Pure-CGI product-hero shot. Product floats and rotates in dramatic studio lighting, sweeping camera move (orbit / dolly-in / snap-zoom), refractive surfaces and rim-light highlights, Apple-keynote reveal aesthetic. NO human dialogue. Dynamic physics-driven motion.",
  },
};

const SYSTEM_PROMPT_SINGLE = `You are an elite short-form ad copywriter. Given a product and a mode, write a SPECIFIC, NON-GENERIC ad script that a creator can film in 12-15 seconds.

Return ONLY a single JSON object — no prose, no markdown fences.

Field rules:
- "hook": ~6 words. The headline. Specific to this product's value prop.
- "spokenScript": one paragraph the on-camera person literally says. 30-45 words. Conversational, vibe-matched to the mode. Must mention the product BY NAME at least once. Open with a curiosity-creating hook in the first 5 words.
- "scenePrompt": describe what the camera shows. The video model will see your reference images of the person + product, so don't redescribe their appearance — just describe the action, environment, lighting, and energy. Use present-progressive language.
- "mode": echo the input mode unchanged.

Style constraints:
- Be SPECIFIC ("this serum saved my 6-month-old breakouts") not GENERIC ("this product is amazing").
- No hyperbolic claims that lawyers will hate ("the best in the world", medical claims). Stay in plausible creator-voice territory.
- No hashtags inside spokenScript.
- For mode="hyper-motion": spokenScript should be 1-3 words only (brand tagline or product name). The product, not a person, is the protagonist.

Return EXACTLY this JSON shape, no other keys:
{
  "hook": string,
  "spokenScript": string,
  "scenePrompt": string,
  "mode": "ugc" | "tv-spot" | "hyper-motion"
}`;

const SYSTEM_PROMPT_VARIANTS = `You are an elite short-form ad copywriter writing A/B/C variants. Given a product and a mode, write THREE distinct ad scripts using fundamentally different creative angles.

The three angles MUST be:
1. **Social-proof angle** — leads with what other people are saying / the result the buyer wants.
2. **Counterintuitive angle** — leads with a surprising or specific claim that creates curiosity (a number, a tradeoff, a contrarian take).
3. **Personal-story angle** — leads with a specific moment / before-and-after from a user's life.

Each variant must be filmable in 12-15 seconds, mention the product by name, and avoid hyperbolic claims.

Return ONLY a single JSON object with a "variants" array of 3 scripts — no prose, no markdown fences.

Per-variant field rules (identical to single-script rules):
- "hook": ~6 words. Headline.
- "spokenScript": 30-45 words spoken by the on-camera person.
- "scenePrompt": present-progressive description of what the camera shows; don't redescribe person/product appearance, just action + lighting + energy.
- "mode": echo input mode.

For mode="hyper-motion": spokenScript is 1-3 words per variant (brand tagline or product name); the visual is the protagonist. The three variants should differ on visual treatment (close-up product reveal / floating-orbit / liquid-splash macro), not spoken script.

Return EXACTLY this JSON shape:
{
  "variants": [
    { "hook": string, "spokenScript": string, "scenePrompt": string, "mode": "ugc" | "tv-spot" | "hyper-motion", "angle": "social-proof" | "counterintuitive" | "personal-story" },
    { "hook": string, "spokenScript": string, "scenePrompt": string, "mode": "ugc" | "tv-spot" | "hyper-motion", "angle": "social-proof" | "counterintuitive" | "personal-story" },
    { "hook": string, "spokenScript": string, "scenePrompt": string, "mode": "ugc" | "tv-spot" | "hyper-motion", "angle": "social-proof" | "counterintuitive" | "personal-story" }
  ]
}`;

/**
 * Generate one ad script. Used for single-output Marketing Studio submissions.
 * For A/B/C variants, use `writeAdScripts(opts, 3)` instead — it's cheaper
 * (one Claude call producing 3 variants in parallel).
 */
export async function writeAdScript(opts: {
  product: ProductInfo;
  mode: MarketingMode;
  notes?: string;
}): Promise<AdScript> {
  const scripts = await writeAdScripts(opts, 1);
  return scripts[0];
}

/**
 * Generate `count` ad scripts in a single Claude call.
 * - count=1 → one script, returns array of length 1.
 * - count=3 → three scripts with social-proof / counterintuitive / personal-story
 *   angles, returned in that order.
 *
 * Other count values aren't supported in v1.
 */
export async function writeAdScripts(
  opts: { product: ProductInfo; mode: MarketingMode; notes?: string },
  count: 1 | 3 = 1,
): Promise<AdScript[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const profile = MODE_PROFILES[opts.mode];
  const userMsg = `# Product
Name: ${opts.product.name}
Brand: ${opts.product.brand ?? "(unknown)"}
Description: ${opts.product.description || "(no description)"}
Price: ${opts.product.price ?? "(unknown)"}
URL: ${opts.product.sourceUrl}

# Mode
${opts.mode} — vibe: ${profile.vibe}
Format: ${profile.format}

# Creator notes
${opts.notes?.trim() ? opts.notes.trim() : "(none — use your judgment)"}

${count === 3
  ? "Write THREE distinct ad scripts using the social-proof, counterintuitive, and personal-story angles defined in the system prompt. Return the variants array."
  : "Write the ad script as a single JSON object matching the schema."}`;

  const systemText = count === 3 ? SYSTEM_PROMPT_VARIANTS : SYSTEM_PROMPT_SINGLE;

  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: count === 3 ? 2400 : 1200,
    system: [
      {
        type: "text",
        text: systemText,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMsg }],
  });

  const textBlock = response.content.find((c) => c.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Claude returned no text content");

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Could not parse Claude response — please try again");
  const parsed = JSON.parse(jsonMatch[0]) as { variants?: Partial<AdScript>[] } & Partial<AdScript>;

  const raw = count === 3
    ? Array.isArray(parsed.variants) ? parsed.variants : []
    : [parsed];

  if (raw.length === 0) throw new Error("Claude returned no scripts");

  return raw.slice(0, count).map((p) => {
    const mode = (p.mode as MarketingMode) || opts.mode;
    const scenePrompt = `${String(p.scenePrompt ?? "")} ${profile.tail}`.trim();
    return {
      hook: String(p.hook ?? "").trim() || `Discover ${opts.product.name}`,
      spokenScript: String(p.spokenScript ?? "").trim(),
      scenePrompt,
      mode,
    };
  });
}
