import Anthropic from "@anthropic-ai/sdk";
import type { ContentMode } from "@/generated/prisma/client";

let _client: Anthropic | null = null;

function getClient() {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return _client;
}

export type PromptClassification = {
  allowed: boolean;
  contentMode: ContentMode;
  sexualContent: boolean;
  minorContent: boolean;
  minorTerms: string[];
  violenceLevel: "none" | "mild" | "moderate" | "extreme";
  realPersonReference: boolean;
  reason?: string;
};

const CLASSIFIER_SYSTEM_PROMPT = `You are a content classification system for an AI video generation platform. Analyze the user's generation prompt and return ONLY a JSON object with no other text.

Your job is to detect:
1. Whether the prompt contains sexual or explicit content
2. Whether the prompt references or implies minors (anyone under 18)
3. Whether the combination of sexual content + minor references exists (this is always a hard block)
4. Whether the prompt contains extreme violence, gore, or illegal activity descriptions
5. Whether the prompt references a real, identifiable person by name

Classification rules:
- "teen", "teenage", "young" are NOT inherently problematic in non-sexual contexts
- "barely legal", "innocent", "schoolgirl" + ANY sexual context = hard block
- Age descriptors like "18 year old" in sexual contexts are suspicious — flag but allow in NSFW mode
- Descriptions of children, babies, toddlers in ANY suggestive context = hard block
- References to real people by name (celebrities, politicians, public figures) = block (deepfake prevention)
- Standard creative/cinematic descriptions of adults = allow
- Extreme violence, gore, torture, or snuff = hard block
- Illegal activity (drug manufacturing, weapons construction, terrorism) = hard block

Return this exact JSON structure:
{
  "sexualContent": boolean,
  "minorContent": boolean,
  "minorTerms": string[],
  "violenceLevel": "none" | "mild" | "moderate" | "extreme",
  "realPersonReference": boolean,
  "reason": "string explaining the classification"
}`;

export async function classifyPrompt(
  prompt: string,
  contentMode: ContentMode
): Promise<PromptClassification> {
  try {
    const response = await getClient().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: CLASSIFIER_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Content mode: ${contentMode}\nPrompt to classify: "${prompt}"`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    const result = JSON.parse(text.replace(/```json|```/g, "").trim());

    // Hard blocks — never allowed regardless of content mode
    if (result.minorContent && result.sexualContent) {
      return {
        allowed: false,
        contentMode,
        minorContent: true,
        minorTerms: result.minorTerms || [],
        sexualContent: true,
        violenceLevel: result.violenceLevel || "none",
        realPersonReference: result.realPersonReference || false,
        reason: "HARD_BLOCK: Sexual content combined with minor references",
      };
    }

    if (result.realPersonReference) {
      return {
        allowed: false,
        contentMode,
        minorContent: result.minorContent || false,
        minorTerms: result.minorTerms || [],
        sexualContent: result.sexualContent || false,
        violenceLevel: result.violenceLevel || "none",
        realPersonReference: true,
        reason: "BLOCK: Real person likeness generation not permitted",
      };
    }

    if (result.violenceLevel === "extreme") {
      return {
        allowed: false,
        contentMode,
        minorContent: result.minorContent || false,
        minorTerms: result.minorTerms || [],
        sexualContent: result.sexualContent || false,
        violenceLevel: "extreme",
        realPersonReference: false,
        reason: "HARD_BLOCK: Extreme violence/gore not permitted",
      };
    }

    // SFW mode blocks
    if (contentMode === "SFW" && result.sexualContent) {
      return {
        allowed: false,
        contentMode,
        minorContent: false,
        minorTerms: [],
        sexualContent: true,
        violenceLevel: result.violenceLevel || "none",
        realPersonReference: false,
        reason: "SFW_BLOCK: Sexual content not allowed in standard mode",
      };
    }

    // NSFW mode — allow sexual content for verified adults, still block minors
    if (contentMode === "NSFW" && result.minorContent) {
      return {
        allowed: false,
        contentMode,
        minorContent: true,
        minorTerms: result.minorTerms || [],
        sexualContent: result.sexualContent || false,
        violenceLevel: result.violenceLevel || "none",
        realPersonReference: false,
        reason: "HARD_BLOCK: Minor references not allowed in any mode",
      };
    }

    return {
      allowed: true,
      contentMode,
      minorContent: false,
      minorTerms: [],
      sexualContent: result.sexualContent || false,
      violenceLevel: result.violenceLevel || "none",
      realPersonReference: false,
    };
  } catch (error) {
    // CRITICAL: Fail safe — never let an unclassified prompt through
    const errMsg = error instanceof Error ? error.message : String(error);
    const errName = error instanceof Error ? error.constructor.name : "Unknown";
    console.error(`[prompt-classifier] FAILED: type=${errName}, message=${errMsg}, hasApiKey=${!!process.env.ANTHROPIC_API_KEY}`);
    return {
      allowed: false,
      contentMode,
      minorContent: false,
      minorTerms: [],
      sexualContent: false,
      violenceLevel: "none",
      realPersonReference: false,
      reason: "SYSTEM_ERROR: Classification failed, blocked by default",
    };
  }
}
