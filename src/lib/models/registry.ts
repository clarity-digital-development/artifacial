// ─── Model Registry ───
// Single source of truth for all generation models.
// Used by: generation router, fal-client, generate page UI, API validation.

export type ModelProvider = "FAL" | "SELF_HOSTED";
export type ModelTier = "BUDGET" | "STANDARD" | "ULTRA";
export type ModelContentMode = "SFW" | "NSFW" | "BOTH";
export type ModelMode = "T2V" | "I2V" | "T2I" | "MOTION_TRANSFER";

export interface ModelConfig {
  id: string;
  name: string;
  provider: ModelProvider;
  endpoints: {
    t2v?: string;
    i2v?: string;
    t2i?: string;
    motionControl?: string;
  };
  tier: ModelTier;
  creditCost: number;
  supportedModes: ModelMode[];
  maxDuration: number;
  maxResolution: string;
  supportsAudio: boolean;
  contentMode: ModelContentMode;
  description: string;
}

// ─── SFW Models (fal.ai) ───

const LTX_19B: ModelConfig = {
  id: "ltx-19b",
  name: "LTX 19B",
  provider: "FAL",
  endpoints: {
    t2v: "fal-ai/ltx-video/v2.0/19b",
    i2v: "fal-ai/ltx-video/v2.0/19b/image-to-video",
  },
  tier: "BUDGET",
  creditCost: 1,
  supportedModes: ["T2V", "I2V"],
  maxDuration: 5,
  maxResolution: "1080p",
  supportsAudio: true,
  contentMode: "SFW",
  description: "Fast and affordable. Great for quick iterations.",
};

const WAN_26: ModelConfig = {
  id: "wan-26",
  name: "Wan 2.6",
  provider: "FAL",
  endpoints: {
    t2v: "wan/v2.6/text-to-video",
    i2v: "wan/v2.6/image-to-video",
  },
  tier: "BUDGET",
  creditCost: 1,
  supportedModes: ["T2V", "I2V"],
  maxDuration: 15,
  maxResolution: "1080p",
  supportsAudio: true,
  contentMode: "SFW",
  description: "Long-form budget option. Up to 15 seconds.",
};

const HAILUO_23: ModelConfig = {
  id: "hailuo-23",
  name: "Hailuo 2.3",
  provider: "FAL",
  endpoints: {
    t2v: "fal-ai/minimax/hailuo-02/standard/text-to-video",
    i2v: "fal-ai/minimax/hailuo-02/standard/image-to-video",
  },
  tier: "STANDARD",
  creditCost: 1,
  supportedModes: ["T2V", "I2V"],
  maxDuration: 6,
  maxResolution: "768p",
  supportsAudio: false,
  contentMode: "SFW",
  description: "Smooth motion. Great for social content.",
};

const SEEDANCE_15: ModelConfig = {
  id: "seedance-15",
  name: "Seedance 1.5 Pro",
  provider: "FAL",
  endpoints: {
    t2v: "fal-ai/seedance/v1.5/pro/text-to-video",
    i2v: "fal-ai/seedance/v1.5/pro/image-to-video",
  },
  tier: "STANDARD",
  creditCost: 1,
  supportedModes: ["T2V", "I2V"],
  maxDuration: 12,
  maxResolution: "1080p",
  supportsAudio: true,
  contentMode: "SFW",
  description: "Versatile with long duration support.",
};

const KLING_25_TURBO: ModelConfig = {
  id: "kling-25-turbo",
  name: "Kling 2.5 Turbo",
  provider: "FAL",
  endpoints: {
    t2v: "fal-ai/kling-video/v2.5/turbo/pro/text-to-video",
    i2v: "fal-ai/kling-video/v2.5/turbo/pro/image-to-video",
  },
  tier: "STANDARD",
  creditCost: 1,
  supportedModes: ["T2V", "I2V"],
  maxDuration: 10,
  maxResolution: "1080p",
  supportsAudio: false,
  contentMode: "SFW",
  description: "Fast and reliable. Our default model.",
};

const SORA_2_PRO: ModelConfig = {
  id: "sora-2-pro",
  name: "Sora 2 Pro",
  provider: "FAL",
  endpoints: {
    t2v: "fal-ai/sora-2/pro/text-to-video",
    i2v: "fal-ai/sora-2/pro/image-to-video",
  },
  tier: "ULTRA",
  creditCost: 2,
  supportedModes: ["T2V", "I2V"],
  maxDuration: 25,
  maxResolution: "1080p",
  supportsAudio: true,
  contentMode: "SFW",
  description: "OpenAI's flagship. Up to 25 seconds.",
};

const KLING_30_PRO: ModelConfig = {
  id: "kling-30-pro",
  name: "Kling 3.0 Pro",
  provider: "FAL",
  endpoints: {
    t2v: "fal-ai/kling-video/v3/pro/text-to-video",
    i2v: "fal-ai/kling-video/v3/pro/image-to-video",
  },
  tier: "ULTRA",
  creditCost: 2,
  supportedModes: ["T2V", "I2V"],
  maxDuration: 15,
  maxResolution: "4K",
  supportsAudio: true,
  contentMode: "SFW",
  description: "Premium quality. 4K with audio.",
};

const VEO_31: ModelConfig = {
  id: "veo-31",
  name: "Veo 3.1",
  provider: "FAL",
  endpoints: {
    t2v: "fal-ai/veo3.1/text-to-video",
    i2v: "fal-ai/veo3.1/image-to-video",
  },
  tier: "ULTRA",
  creditCost: 2,
  supportedModes: ["T2V", "I2V"],
  maxDuration: 8,
  maxResolution: "4K",
  supportsAudio: true,
  contentMode: "SFW",
  description: "Google's best. 4K cinematic output.",
};

// ─── SFW Motion Control Models (fal.ai) ───

const KLING_26_MOTION_STD: ModelConfig = {
  id: "kling-26-motion-std",
  name: "Kling 2.6 Motion (Standard)",
  provider: "FAL",
  endpoints: {
    motionControl: "fal-ai/kling-video/v2.6/standard/motion-control",
  },
  tier: "STANDARD",
  creditCost: 1,
  supportedModes: ["MOTION_TRANSFER"],
  maxDuration: 10,
  maxResolution: "1080p",
  supportsAudio: false,
  contentMode: "SFW",
  description: "Copy motion from reference video. Standard quality.",
};

const KLING_26_MOTION_PRO: ModelConfig = {
  id: "kling-26-motion-pro",
  name: "Kling 2.6 Motion (Pro)",
  provider: "FAL",
  endpoints: {
    motionControl: "fal-ai/kling-video/v2.6/pro/motion-control",
  },
  tier: "ULTRA",
  creditCost: 2,
  supportedModes: ["MOTION_TRANSFER"],
  maxDuration: 10,
  maxResolution: "1080p",
  supportsAudio: false,
  contentMode: "SFW",
  description: "Copy motion from reference video. Pro quality.",
};

// ─── NSFW Models (Self-Hosted) ───

const WAN22_NSFW_T2V: ModelConfig = {
  id: "wan22-nsfw-t2v",
  name: "Wan 2.2 NSFW",
  provider: "SELF_HOSTED",
  endpoints: {},
  tier: "STANDARD",
  creditCost: 1,
  supportedModes: ["T2V"],
  maxDuration: 5,
  maxResolution: "720p",
  supportsAudio: false,
  contentMode: "NSFW",
  description: "Unrestricted text-to-video. Self-hosted.",
};

const WAN22_NSFW_I2V: ModelConfig = {
  id: "wan22-nsfw-i2v",
  name: "Wan 2.2 NSFW",
  provider: "SELF_HOSTED",
  endpoints: {},
  tier: "STANDARD",
  creditCost: 1,
  supportedModes: ["I2V"],
  maxDuration: 5,
  maxResolution: "720p",
  supportsAudio: false,
  contentMode: "NSFW",
  description: "Unrestricted image-to-video. Self-hosted.",
};

const WAN22_NSFW_T2V_LITE: ModelConfig = {
  id: "wan22-nsfw-t2v-lite",
  name: "Wan 2.2 NSFW Lite",
  provider: "SELF_HOSTED",
  endpoints: {},
  tier: "BUDGET",
  creditCost: 1,
  supportedModes: ["T2V"],
  maxDuration: 5,
  maxResolution: "720p",
  supportsAudio: false,
  contentMode: "NSFW",
  description: "Fast unrestricted generation. Lower VRAM.",
};

// ─── NSFW Image Models (Self-Hosted) ───

const CHROMA_HD: ModelConfig = {
  id: "chroma-hd",
  name: "CHROMA HD",
  provider: "SELF_HOSTED",
  endpoints: {},
  tier: "BUDGET",
  creditCost: 1,
  supportedModes: ["T2I"],
  maxDuration: 0,
  maxResolution: "1024px",
  supportsAudio: false,
  contentMode: "NSFW",
  description: "Fast uncensored images. 1-4 steps. Best for stylized/fantasy.",
};

const JUGGERNAUT_XL: ModelConfig = {
  id: "juggernaut-xl",
  name: "Juggernaut XL Ragnarok",
  provider: "SELF_HOSTED",
  endpoints: {},
  tier: "STANDARD",
  creditCost: 1,
  supportedModes: ["T2I"],
  maxDuration: 0,
  maxResolution: "1024px",
  supportsAudio: false,
  contentMode: "NSFW",
  description: "Best photorealism. SDXL architecture. Ideal for realistic subjects.",
};

// ─── Registry ───

export const MODEL_REGISTRY: Record<string, ModelConfig> = {
  // SFW — Budget
  [LTX_19B.id]: LTX_19B,
  [WAN_26.id]: WAN_26,
  // SFW — Standard
  [HAILUO_23.id]: HAILUO_23,
  [SEEDANCE_15.id]: SEEDANCE_15,
  [KLING_25_TURBO.id]: KLING_25_TURBO,
  // SFW — Ultra
  [SORA_2_PRO.id]: SORA_2_PRO,
  [KLING_30_PRO.id]: KLING_30_PRO,
  [VEO_31.id]: VEO_31,
  // Motion Control
  [KLING_26_MOTION_STD.id]: KLING_26_MOTION_STD,
  [KLING_26_MOTION_PRO.id]: KLING_26_MOTION_PRO,
  // NSFW — Video
  [WAN22_NSFW_T2V.id]: WAN22_NSFW_T2V,
  [WAN22_NSFW_I2V.id]: WAN22_NSFW_I2V,
  [WAN22_NSFW_T2V_LITE.id]: WAN22_NSFW_T2V_LITE,
  // NSFW — Image
  [CHROMA_HD.id]: CHROMA_HD,
  [JUGGERNAUT_XL.id]: JUGGERNAUT_XL,
};

// ─── Lookup helpers ───

export function getModelById(id: string): ModelConfig | undefined {
  return MODEL_REGISTRY[id];
}

export function isValidModelId(id: string): boolean {
  return id in MODEL_REGISTRY;
}

/**
 * Calculate credit cost for a generation.
 * Base cost from model tier, multiplied by duration (5s = 1x, 10s = 2x, 15s = 3x).
 */
export function calculateCreditCost(modelId: string, durationSec: number): number {
  const model = getModelById(modelId);
  if (!model) throw new Error(`Unknown model: ${modelId}`);
  // Image models: flat cost, no duration multiplier
  if (model.supportedModes.includes("T2I")) return model.creditCost;
  const durationMultiplier = Math.ceil(durationSec / 5);
  return model.creditCost * durationMultiplier;
}

/**
 * Get the appropriate endpoint for a model given the generation mode.
 */
export function getModelEndpoint(modelId: string, mode: ModelMode): string | undefined {
  const model = getModelById(modelId);
  if (!model) return undefined;
  switch (mode) {
    case "T2V": return model.endpoints.t2v;
    case "I2V": return model.endpoints.i2v;
    case "T2I": return model.endpoints.t2i;
    case "MOTION_TRANSFER": return model.endpoints.motionControl;
  }
}

/**
 * Get default model ID for a given mode and content preference.
 */
export function getDefaultModelId(mode: ModelMode, contentMode: "SFW" | "NSFW"): string {
  if (contentMode === "NSFW") {
    if (mode === "T2V") return "wan22-nsfw-t2v";
    if (mode === "I2V") return "wan22-nsfw-i2v";
    if (mode === "T2I") return "juggernaut-xl";
  }
  if (mode === "MOTION_TRANSFER") return "kling-26-motion-std";
  return "kling-30-pro";
}

// ─── Tier sorting order ───

const TIER_ORDER: Record<ModelTier, number> = { BUDGET: 0, STANDARD: 1, ULTRA: 2 };

/**
 * Get models filtered by mode and content mode, sorted by tier.
 */
export function getModelsForMode(
  mode: ModelMode,
  contentMode: "SFW" | "NSFW"
): ModelConfig[] {
  return Object.values(MODEL_REGISTRY)
    .filter((m) => {
      if (!m.supportedModes.includes(mode)) return false;
      if (contentMode === "SFW") return m.contentMode === "SFW" || m.contentMode === "BOTH";
      // NSFW users see both SFW and NSFW models
      return true;
    })
    .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);
}

/**
 * Group models by tier for display.
 */
export function getModelsGroupedByTier(
  mode: ModelMode,
  contentMode: "SFW" | "NSFW"
): { tier: ModelTier; label: string; models: ModelConfig[] }[] {
  const models = getModelsForMode(mode, contentMode);
  const groups: { tier: ModelTier; label: string; models: ModelConfig[] }[] = [];

  const tierLabels: Record<ModelTier, string> = {
    BUDGET: "Budget (1 credit)",
    STANDARD: "Standard (1 credit)",
    ULTRA: "Ultra (2 credits)",
  };

  for (const tier of ["BUDGET", "STANDARD", "ULTRA"] as ModelTier[]) {
    const tierModels = models.filter((m) => m.tier === tier);
    if (tierModels.length > 0) {
      groups.push({ tier, label: tierLabels[tier], models: tierModels });
    }
  }

  return groups;
}
