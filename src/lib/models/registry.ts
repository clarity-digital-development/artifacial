// ─── Model Registry ───
// Single source of truth for all generation models.
// All models route through PiAPI. No self-hosted or fal.ai models.

export type ModelProvider = "PIAPI";
export type ModelTier = "BUDGET" | "STANDARD" | "ULTRA";
export type ModelContentMode = "SFW" | "NSFW" | "BOTH";
export type ModelMode = "T2V" | "I2V" | "T2I" | "MOTION_TRANSFER";

export interface PiApiConfig {
  model: string;                          // PiAPI model string (e.g., "kling", "Qubico/wan2.6")
  taskTypes: Partial<Record<ModelMode, string>>;  // mode → PiAPI task_type
  defaults?: Record<string, unknown>;     // Model-specific defaults (e.g., version, mode)
  costKey: string;                        // Key into cost estimation table
}

export interface ModelConfig {
  id: string;
  name: string;
  provider: ModelProvider;
  pipiConfig: PiApiConfig;
  tier: ModelTier;
  creditCost: number;
  supportedModes: ModelMode[];
  maxDuration: number;
  maxResolution: string;
  supportsAudio: boolean;
  contentMode: ModelContentMode;
  description: string;
  // ─── Capability constraints ───
  durations: number[];
  aspectRatios: string[];
  resolutions: string[];
  supportsEndFrame: boolean;
}

// ════════════════════════════════════════════════════════════════
// SFW VIDEO MODELS
// ════════════════════════════════════════════════════════════════

const WAN_26_SFW: ModelConfig = {
  id: "wan-26",
  name: "Wan 2.6",
  provider: "PIAPI",
  pipiConfig: {
    model: "Qubico/wan2.6",
    taskTypes: { T2V: "txt2video", I2V: "img2video" },
    costKey: "wan-26",
  },
  tier: "BUDGET",
  creditCost: 1,
  supportedModes: ["T2V", "I2V"],
  maxDuration: 10,
  maxResolution: "1080p",
  supportsAudio: false,
  contentMode: "SFW",
  description: "Budget option. Up to 10 seconds.",
  durations: [5, 10],
  aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
  resolutions: ["720p", "1080p"],
  supportsEndFrame: false,
};

const WAN_22_SFW: ModelConfig = {
  id: "wan-22",
  name: "Wan 2.2",
  provider: "PIAPI",
  pipiConfig: {
    model: "Qubico/wanx",
    taskTypes: { T2V: "wan22-txt2video-14b", I2V: "wan22-img2video-14b" },
    costKey: "wan-22",
  },
  tier: "BUDGET",
  creditCost: 1,
  supportedModes: ["T2V", "I2V"],
  maxDuration: 5,
  maxResolution: "720p",
  supportsAudio: false,
  contentMode: "SFW",
  description: "Economy option. Fast generation.",
  durations: [5],
  aspectRatios: ["16:9", "9:16"],
  resolutions: [],
  supportsEndFrame: false,
};

const FRAMEPACK: ModelConfig = {
  id: "framepack",
  name: "Framepack",
  provider: "PIAPI",
  pipiConfig: {
    model: "Qubico/framepack",
    taskTypes: { I2V: "img2video" },
    costKey: "framepack",
  },
  tier: "BUDGET",
  creditCost: 1,
  supportedModes: ["I2V"],
  maxDuration: 30,
  maxResolution: "720p",
  supportsAudio: false,
  contentMode: "SFW",
  description: "Long-form I2V. Up to 30 seconds at $0.03/sec.",
  durations: [10, 15, 20, 30],
  aspectRatios: [],
  resolutions: [],
  supportsEndFrame: true,
};

const KLING_26_STD: ModelConfig = {
  id: "kling-26-std",
  name: "Kling 2.6 Standard",
  provider: "PIAPI",
  pipiConfig: {
    model: "kling",
    taskTypes: { T2V: "video_generation", I2V: "video_generation" },
    defaults: { version: "2.6", mode: "std" },
    costKey: "kling-26-std",
  },
  tier: "STANDARD",
  creditCost: 1,
  supportedModes: ["T2V", "I2V"],
  maxDuration: 10,
  maxResolution: "720p",
  supportsAudio: true,
  contentMode: "SFW",
  description: "Reliable standard quality. Native audio.",
  durations: [5, 10],
  aspectRatios: ["16:9", "9:16", "1:1"],
  resolutions: [],
  supportsEndFrame: true,
};

const SEEDANCE_2: ModelConfig = {
  id: "seedance-2",
  name: "Seedance 2",
  provider: "PIAPI",
  pipiConfig: {
    model: "seedance",
    taskTypes: { T2V: "seedance-2-fast-preview", I2V: "seedance-2-fast-preview" },
    costKey: "seedance-2-fast",
  },
  tier: "STANDARD",
  creditCost: 1,
  supportedModes: ["T2V", "I2V"],
  maxDuration: 15,
  maxResolution: "1080p",
  supportsAudio: false,
  contentMode: "SFW",
  description: "ByteDance's latest. Up to 15 seconds.",
  durations: [5, 10, 15],
  aspectRatios: ["16:9", "9:16", "4:3", "3:4"],
  resolutions: [],
  supportsEndFrame: false,
};

const SORA_2: ModelConfig = {
  id: "sora-2",
  name: "Sora 2",
  provider: "PIAPI",
  pipiConfig: {
    model: "sora2",
    taskTypes: { T2V: "sora2-video", I2V: "sora2-video" },
    costKey: "sora-2",
  },
  tier: "STANDARD",
  creditCost: 1,
  supportedModes: ["T2V", "I2V"],
  maxDuration: 12,
  maxResolution: "720p",
  supportsAudio: false,
  contentMode: "SFW",
  description: "OpenAI's video model. Up to 12 seconds.",
  durations: [4, 8, 12],
  aspectRatios: ["16:9", "9:16"],
  resolutions: [],
  supportsEndFrame: false,
};

const KLING_26_PRO: ModelConfig = {
  id: "kling-26-pro",
  name: "Kling 2.6 Pro",
  provider: "PIAPI",
  pipiConfig: {
    model: "kling",
    taskTypes: { T2V: "video_generation", I2V: "video_generation" },
    defaults: { version: "2.6", mode: "pro" },
    costKey: "kling-26-pro",
  },
  tier: "ULTRA",
  creditCost: 2,
  supportedModes: ["T2V", "I2V"],
  maxDuration: 10,
  maxResolution: "1080p",
  supportsAudio: true,
  contentMode: "SFW",
  description: "Premium Kling quality with audio.",
  durations: [5, 10],
  aspectRatios: ["16:9", "9:16", "1:1"],
  resolutions: [],
  supportsEndFrame: true,
};

const KLING_30_PRO: ModelConfig = {
  id: "kling-30-pro",
  name: "Kling 3.0 Pro",
  provider: "PIAPI",
  pipiConfig: {
    model: "kling",
    taskTypes: { T2V: "video_generation", I2V: "video_generation" },
    defaults: { version: "3.0", mode: "pro" },
    costKey: "kling-30-pro",
  },
  tier: "ULTRA",
  creditCost: 2,
  supportedModes: ["T2V", "I2V"],
  maxDuration: 15,
  maxResolution: "1080p",
  supportsAudio: true,
  contentMode: "SFW",
  description: "Best overall quality. Up to 15 seconds with audio.",
  durations: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  aspectRatios: ["16:9", "9:16", "1:1"],
  resolutions: [],
  supportsEndFrame: true,
};

const SORA_2_PRO: ModelConfig = {
  id: "sora-2-pro",
  name: "Sora 2 Pro",
  provider: "PIAPI",
  pipiConfig: {
    model: "sora2",
    taskTypes: { T2V: "sora2-pro-video", I2V: "sora2-pro-video" },
    costKey: "sora-2-pro",
  },
  tier: "ULTRA",
  creditCost: 2,
  supportedModes: ["T2V", "I2V"],
  maxDuration: 12,
  maxResolution: "1080p",
  supportsAudio: false,
  contentMode: "SFW",
  description: "OpenAI's flagship. 1080p up to 12 seconds.",
  durations: [4, 8, 12],
  aspectRatios: ["16:9", "9:16"],
  resolutions: ["720p", "1080p"],
  supportsEndFrame: false,
};

const VEO_31: ModelConfig = {
  id: "veo-31",
  name: "Veo 3.1",
  provider: "PIAPI",
  pipiConfig: {
    model: "veo3.1",
    taskTypes: { T2V: "veo3.1-video", I2V: "veo3.1-video" },
    costKey: "veo-31",
  },
  tier: "ULTRA",
  creditCost: 2,
  supportedModes: ["T2V", "I2V"],
  maxDuration: 8,
  maxResolution: "1080p",
  supportsAudio: true,
  contentMode: "SFW",
  description: "Google's best. Cinematic quality with audio.",
  durations: [4, 6, 8],
  aspectRatios: ["16:9", "9:16"],
  resolutions: ["720p", "1080p"],
  supportsEndFrame: false,
};

const SEEDANCE_2_PRO: ModelConfig = {
  id: "seedance-2-pro",
  name: "Seedance 2 Pro",
  provider: "PIAPI",
  pipiConfig: {
    model: "seedance",
    taskTypes: { T2V: "seedance-2-preview", I2V: "seedance-2-preview" },
    costKey: "seedance-2",
  },
  tier: "ULTRA",
  creditCost: 2,
  supportedModes: ["T2V", "I2V"],
  maxDuration: 15,
  maxResolution: "1080p",
  supportsAudio: false,
  contentMode: "SFW",
  description: "ByteDance premium. Higher quality, longer queue.",
  durations: [5, 10, 15],
  aspectRatios: ["16:9", "9:16", "4:3", "3:4"],
  resolutions: [],
  supportsEndFrame: false,
};

// ════════════════════════════════════════════════════════════════
// SFW MOTION CONTROL
// ════════════════════════════════════════════════════════════════

const KLING_26_MOTION_STD: ModelConfig = {
  id: "kling-26-motion-std",
  name: "Kling 2.6 Motion (Standard)",
  provider: "PIAPI",
  pipiConfig: {
    model: "kling",
    taskTypes: { MOTION_TRANSFER: "video_generation" },
    defaults: { version: "2.6", mode: "std" },
    costKey: "kling-26-std",
  },
  tier: "STANDARD",
  creditCost: 1,
  supportedModes: ["MOTION_TRANSFER"],
  maxDuration: 10,
  maxResolution: "1080p",
  supportsAudio: false,
  contentMode: "SFW",
  description: "Copy motion from reference video. Standard quality.",
  durations: [5, 10],
  aspectRatios: [],
  resolutions: [],
  supportsEndFrame: false,
};

const KLING_26_MOTION_PRO: ModelConfig = {
  id: "kling-26-motion-pro",
  name: "Kling 2.6 Motion (Pro)",
  provider: "PIAPI",
  pipiConfig: {
    model: "kling",
    taskTypes: { MOTION_TRANSFER: "video_generation" },
    defaults: { version: "2.6", mode: "pro" },
    costKey: "kling-26-pro",
  },
  tier: "ULTRA",
  creditCost: 2,
  supportedModes: ["MOTION_TRANSFER"],
  maxDuration: 10,
  maxResolution: "1080p",
  supportsAudio: false,
  contentMode: "SFW",
  description: "Copy motion from reference video. Pro quality.",
  durations: [5, 10],
  aspectRatios: [],
  resolutions: [],
  supportsEndFrame: false,
};

// ════════════════════════════════════════════════════════════════
// NSFW VIDEO MODELS (PiAPI — NSFW capable)
// ════════════════════════════════════════════════════════════════

const WAN26_NSFW_T2V: ModelConfig = {
  id: "wan26-nsfw-t2v",
  name: "Wan 2.6 NSFW",
  provider: "PIAPI",
  pipiConfig: {
    model: "Qubico/wan2.6",
    taskTypes: { T2V: "txt2video" },
    costKey: "wan-26",
  },
  tier: "STANDARD",
  creditCost: 1,
  supportedModes: ["T2V"],
  maxDuration: 10,
  maxResolution: "1080p",
  supportsAudio: false,
  contentMode: "NSFW",
  description: "Unrestricted text-to-video. Up to 10 seconds.",
  durations: [5, 10],
  aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
  resolutions: ["720p", "1080p"],
  supportsEndFrame: false,
};

const WAN26_NSFW_I2V: ModelConfig = {
  id: "wan26-nsfw-i2v",
  name: "Wan 2.6 NSFW",
  provider: "PIAPI",
  pipiConfig: {
    model: "Qubico/wan2.6",
    taskTypes: { I2V: "img2video" },
    costKey: "wan-26",
  },
  tier: "STANDARD",
  creditCost: 1,
  supportedModes: ["I2V"],
  maxDuration: 10,
  maxResolution: "1080p",
  supportsAudio: false,
  contentMode: "NSFW",
  description: "Unrestricted image-to-video. Up to 10 seconds.",
  durations: [5, 10],
  aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4"],
  resolutions: ["720p", "1080p"],
  supportsEndFrame: false,
};

const WAN22_NSFW_T2V: ModelConfig = {
  id: "wan22-nsfw-t2v",
  name: "Wan 2.2 NSFW",
  provider: "PIAPI",
  pipiConfig: {
    model: "Qubico/wanx",
    taskTypes: { T2V: "wan22-txt2video-14b" },
    costKey: "wan-22",
  },
  tier: "BUDGET",
  creditCost: 1,
  supportedModes: ["T2V"],
  maxDuration: 5,
  maxResolution: "720p",
  supportsAudio: false,
  contentMode: "NSFW",
  description: "Budget NSFW option. Fast 720p generation.",
  durations: [5],
  aspectRatios: ["16:9", "9:16"],
  resolutions: [],
  supportsEndFrame: false,
};

const WAN22_NSFW_I2V: ModelConfig = {
  id: "wan22-nsfw-i2v",
  name: "Wan 2.2 NSFW",
  provider: "PIAPI",
  pipiConfig: {
    model: "Qubico/wanx",
    taskTypes: { I2V: "wan22-img2video-14b" },
    costKey: "wan-22",
  },
  tier: "BUDGET",
  creditCost: 1,
  supportedModes: ["I2V"],
  maxDuration: 5,
  maxResolution: "720p",
  supportsAudio: false,
  contentMode: "NSFW",
  description: "Budget NSFW image-to-video.",
  durations: [5],
  aspectRatios: ["16:9", "9:16"],
  resolutions: [],
  supportsEndFrame: false,
};

// ════════════════════════════════════════════════════════════════
// IMAGE MODELS (SFW + NSFW via PiAPI)
// ════════════════════════════════════════════════════════════════

const Z_IMAGE_TURBO: ModelConfig = {
  id: "z-image-turbo",
  name: "Z-Image Turbo",
  provider: "PIAPI",
  pipiConfig: {
    model: "Qubico/z-image",
    taskTypes: { T2I: "txt2img" },
    costKey: "z-image",
  },
  tier: "BUDGET",
  creditCost: 1,
  supportedModes: ["T2I"],
  maxDuration: 0,
  maxResolution: "1440px",
  supportsAudio: false,
  contentMode: "BOTH",
  description: "Fast photorealistic images. 9 steps, sub-second.",
  durations: [],
  aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16"],
  resolutions: [],
  supportsEndFrame: false,
};

const FLUX_SCHNELL: ModelConfig = {
  id: "flux-schnell",
  name: "Flux Schnell",
  provider: "PIAPI",
  pipiConfig: {
    model: "Qubico/flux1-schnell",
    taskTypes: { T2I: "txt2img" },
    costKey: "flux-schnell",
  },
  tier: "BUDGET",
  creditCost: 1,
  supportedModes: ["T2I"],
  maxDuration: 0,
  maxResolution: "1024px",
  supportsAudio: false,
  contentMode: "SFW",
  description: "Fast Flux generation. Good for iterations.",
  durations: [],
  aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16"],
  resolutions: [],
  supportsEndFrame: false,
};

const QWEN_IMAGE: ModelConfig = {
  id: "qwen-image",
  name: "Qwen Image",
  provider: "PIAPI",
  pipiConfig: {
    model: "qwen-image",
    taskTypes: { T2I: "txt2img" },
    costKey: "qwen-image",
  },
  tier: "STANDARD",
  creditCost: 1,
  supportedModes: ["T2I"],
  maxDuration: 0,
  maxResolution: "1024px",
  supportsAudio: false,
  contentMode: "SFW",
  description: "Alibaba's latest image model.",
  durations: [],
  aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16"],
  resolutions: [],
  supportsEndFrame: false,
};

const SEEDREAM_5: ModelConfig = {
  id: "seedream-5",
  name: "Seedream 5 Lite",
  provider: "PIAPI",
  pipiConfig: {
    model: "seedream",
    taskTypes: { T2I: "seedream-5-lite" },
    costKey: "seedream",
  },
  tier: "STANDARD",
  creditCost: 1,
  supportedModes: ["T2I"],
  maxDuration: 0,
  maxResolution: "3K",
  supportsAudio: false,
  contentMode: "SFW",
  description: "ByteDance image model. Up to 3K resolution.",
  durations: [],
  aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3"],
  resolutions: [],
  supportsEndFrame: false,
};

// ════════════════════════════════════════════════════════════════
// REGISTRY
// ════════════════════════════════════════════════════════════════

export const MODEL_REGISTRY: Record<string, ModelConfig> = {
  // SFW Video — Budget
  [WAN_22_SFW.id]: WAN_22_SFW,
  [WAN_26_SFW.id]: WAN_26_SFW,
  [FRAMEPACK.id]: FRAMEPACK,
  // SFW Video — Standard
  [KLING_26_STD.id]: KLING_26_STD,
  [SEEDANCE_2.id]: SEEDANCE_2,
  [SORA_2.id]: SORA_2,
  // SFW Video — Ultra
  [KLING_26_PRO.id]: KLING_26_PRO,
  [KLING_30_PRO.id]: KLING_30_PRO,
  [SORA_2_PRO.id]: SORA_2_PRO,
  [VEO_31.id]: VEO_31,
  [SEEDANCE_2_PRO.id]: SEEDANCE_2_PRO,
  // Motion Control
  [KLING_26_MOTION_STD.id]: KLING_26_MOTION_STD,
  [KLING_26_MOTION_PRO.id]: KLING_26_MOTION_PRO,
  // NSFW Video
  [WAN22_NSFW_T2V.id]: WAN22_NSFW_T2V,
  [WAN22_NSFW_I2V.id]: WAN22_NSFW_I2V,
  [WAN26_NSFW_T2V.id]: WAN26_NSFW_T2V,
  [WAN26_NSFW_I2V.id]: WAN26_NSFW_I2V,
  // Image — SFW + NSFW
  [Z_IMAGE_TURBO.id]: Z_IMAGE_TURBO,
  [FLUX_SCHNELL.id]: FLUX_SCHNELL,
  [QWEN_IMAGE.id]: QWEN_IMAGE,
  [SEEDREAM_5.id]: SEEDREAM_5,
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
  if (model.supportedModes.includes("T2I")) return model.creditCost;
  const durationMultiplier = Math.ceil(durationSec / 5);
  return model.creditCost * durationMultiplier;
}

/**
 * Get the PiAPI task type for a model given the generation mode.
 */
export function getPiApiTaskType(modelId: string, mode: ModelMode): string | undefined {
  const model = getModelById(modelId);
  if (!model) return undefined;
  return model.pipiConfig.taskTypes[mode];
}

/**
 * Get default model ID for a given mode and content preference.
 */
export function getDefaultModelId(mode: ModelMode, contentMode: "SFW" | "NSFW"): string {
  if (contentMode === "NSFW") {
    if (mode === "T2V") return "wan26-nsfw-t2v";
    if (mode === "I2V") return "wan26-nsfw-i2v";
    if (mode === "T2I") return "z-image-turbo";
  }
  if (mode === "MOTION_TRANSFER") return "kling-26-motion-std";
  if (mode === "T2I") return "z-image-turbo";
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
