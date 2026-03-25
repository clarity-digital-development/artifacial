import { getVeniceClient, VENICE_MODEL, withVeniceRetry } from "@/lib/venice";
import { filterPromptKeywords } from "./keyword-filter";
import type { ContentMode } from "@/generated/prisma/client";

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
  // Layer 1: Fast keyword/pattern filter (no API call)
  const keywordResult = filterPromptKeywords(prompt);
  if (keywordResult.blocked) {
    return {
      allowed: false,
      contentMode,
      sexualContent: false,
      minorContent: keywordResult.reason?.includes("CSAM") || false,
      minorTerms: [],
      violenceLevel: "none",
      realPersonReference: false,
      reason: `HARD_BLOCK: ${keywordResult.reason}`,
    };
  }

  // Layer 2: Venice AI classification (LLM semantic understanding)
  try {
    const client = getVeniceClient();
    const response = await withVeniceRetry(
      () => client.chat.completions.create({
        model: VENICE_MODEL,
        max_completion_tokens: 500,
        temperature: 0,
        messages: [
          { role: "system", content: CLASSIFIER_SYSTEM_PROMPT },
          {
            role: "user",
            content: `Content mode: ${contentMode}\nPrompt to classify: "${prompt}"`,
          },
        ],
        ...({ venice_parameters: { include_venice_system_prompt: false } } as Record<string, unknown>),
      }),
      2,
      "prompt-classifier",
    );

    const text = response.choices[0]?.message?.content || "";
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
    console.error(`[prompt-classifier] FAILED: type=${errName}, message=${errMsg}, hasApiKey=${!!process.env.VENICE_API_KEY}`);
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
