// ─── Model Registry ───
// Single source of truth for all generation models.
// SFW models route through PiAPI. NSFW models route through Venice AI.

export type ModelProvider = "PIAPI" | "VENICE";
export type ModelTier = "BUDGET" | "STANDARD" | "ULTRA";
export type ModelContentMode = "SFW" | "NSFW" | "BOTH";
export type ModelMode = "T2V" | "I2V" | "T2I" | "MOTION_TRANSFER";

export interface PiApiConfig {
  model: string;                          // PiAPI model string (e.g., "kling", "Qubico/wan2.6")
  taskTypes: Partial<Record<ModelMode, string>>;  // mode → PiAPI task_type
  defaults?: Record<string, unknown>;     // Model-specific defaults (e.g., version, mode)
  costKey: string;                        // Key into cost estimation table
}

export interface VeniceConfig {
  model: string;                          // Venice model ID (e.g., "wan-2.6-text-to-video")
  costKey: string;                        // Key into cost estimation table
}

/**
 * Credit cost lookup table. Keys are "${durationSec}_${resolution}" for video,
 * or just the flat cost number for images (stored in `creditCost`).
 * Example: { "5_720p": 300, "10_720p": 550, "5_1080p": 500, "10_1080p": 900 }
 */
export type CreditCostTable = Record<string, number>;

export interface ModelConfig {
  id: string;
  name: string;
  provider: ModelProvider;
  pipiConfig?: PiApiConfig;               // Required for PIAPI models
  veniceConfig?: VeniceConfig;            // Required for VENICE models
  badge?: string;                         // Optional UI badge (e.g. "Beta")
  tier: ModelTier;
  creditCost: number;                     // Flat cost for images, or base/fallback for video
  creditCostTable?: CreditCostTable;      // Duration+resolution cost lookup for video models
  audioCreditAddon?: Record<string, number>; // Audio surcharge keyed by "${duration}" (e.g. "5": 1000)
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
    model: "Wan",
    taskTypes: { T2V: "wan26-txt2video", I2V: "wan26-img2video" },
    costKey: "wan-26",
  },
  tier: "BUDGET",
  creditCost: 1700,
  creditCostTable: {
    "5_720p": 1700, "10_720p": 3300,
    "5_1080p": 2500, "10_1080p": 4900,
  },
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
  creditCost: 300,
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
  creditCost: 300,
  creditCostTable: { "10": 300, "15": 450, "20": 600, "30": 900 },
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
  creditCost: 850,
  creditCostTable: { "5": 850, "10": 1700 },
  audioCreditAddon: { "5": 550, "10": 1100 },
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
  creditCost: 1100,
  creditCostTable: { "5": 1100 },
  supportedModes: ["T2V", "I2V"],
  maxDuration: 5,
  maxResolution: "1080p",
  supportsAudio: false,
  contentMode: "SFW",
  description: "ByteDance's latest.",
  durations: [5],
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
  creditCost: 300,
  creditCostTable: { "4": 240, "8": 480, "12": 720 },
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
  creditCost: 1400,
  creditCostTable: { "5": 1400, "10": 2700 },
  audioCreditAddon: { "5": 550, "10": 1100 },
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
    taskTypes: { T2V: "omni_video_generation", I2V: "omni_video_generation" },
    defaults: { version: "3.0" },
    costKey: "kling-30-pro",
  },
  tier: "ULTRA",
  creditCost: 2100,
  creditCostTable: {
    "5_720p": 2100, "10_720p": 4100,
    "5_1080p": 3100, "10_1080p": 6100,
  },
  audioCreditAddon: { "5": 1000, "10": 2000 },
  supportedModes: ["T2V", "I2V"],
  maxDuration: 10,
  maxResolution: "1080p",
  supportsAudio: true,
  contentMode: "SFW",
  description: "Best overall quality. Up to 10 seconds with audio.",
  durations: [5, 10],
  aspectRatios: ["16:9", "9:16", "1:1"],
  resolutions: ["720p", "1080p"],
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
  creditCost: 500,
  creditCostTable: {
    "4_720p": 480, "8_720p": 960, "12_720p": 1440,
    "4_1080p": 720, "8_1080p": 1440, "12_1080p": 2160,
  },
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
  creditCost: 500,
  creditCostTable: {
    "4_720p": 480, "6_720p": 720, "8_720p": 960,
    "4_1080p": 720, "6_1080p": 1080, "8_1080p": 1440,
  },
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
  creditCost: 1100,
  creditCostTable: { "5": 1100 },
  supportedModes: ["T2V", "I2V"],
  maxDuration: 5,
  maxResolution: "1080p",
  supportsAudio: false,
  contentMode: "SFW",
  description: "ByteDance premium. Higher quality.",
  durations: [5],
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
  creditCost: 850,
  creditCostTable: { "5": 850, "10": 1700 },
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
  creditCost: 1400,
  creditCostTable: { "5": 1400, "10": 2700 },
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
// NSFW VIDEO MODELS (Venice AI — native uncensored generation)
// ════════════════════════════════════════════════════════════════

const WAN26_NSFW_T2V: ModelConfig = {
  id: "wan26-nsfw-t2v",
  name: "Wan 2.6 NSFW",
  provider: "VENICE",
  veniceConfig: {
    model: "wan-2.6-text-to-video",
    costKey: "venice-wan-26",
  },
  badge: "Beta",
  tier: "STANDARD",
  creditCost: 1700,
  creditCostTable: { "5": 1700, "10": 3300 },
  supportedModes: ["T2V"],
  maxDuration: 10,
  maxResolution: "1080p",
  supportsAudio: false,
  contentMode: "NSFW",
  description: "Unrestricted text-to-video. Up to 10 seconds.",
  durations: [5, 10],
  aspectRatios: ["16:9", "9:16", "1:1"],
  resolutions: ["720p", "1080p"],
  supportsEndFrame: false,
};

const WAN26_NSFW_I2V: ModelConfig = {
  id: "wan26-nsfw-i2v",
  name: "Wan 2.6 NSFW",
  provider: "VENICE",
  veniceConfig: {
    model: "wan-2.6-image-to-video",
    costKey: "venice-wan-26",
  },
  badge: "Beta",
  tier: "STANDARD",
  creditCost: 1700,
  creditCostTable: { "5": 1700, "10": 3300 },
  supportedModes: ["I2V"],
  maxDuration: 10,
  maxResolution: "1080p",
  supportsAudio: false,
  contentMode: "NSFW",
  description: "Unrestricted image-to-video. Up to 10 seconds.",
  durations: [5, 10],
  aspectRatios: ["16:9", "9:16", "1:1"],
  resolutions: ["720p", "1080p"],
  supportsEndFrame: false,
};

const WAN22_NSFW_T2V: ModelConfig = {
  id: "wan22-nsfw-t2v",
  name: "Wan 2.2 NSFW",
  provider: "VENICE",
  veniceConfig: {
    model: "wan-2.2-a14b-text-to-video",
    costKey: "venice-wan-22",
  },
  tier: "BUDGET",
  creditCost: 1250,
  creditCostTable: { "5": 1250 },
  supportedModes: ["T2V"],
  maxDuration: 5,
  maxResolution: "720p",
  supportsAudio: false,
  contentMode: "NSFW",
  description: "Most consistent NSFW generation. Fast 720p.",
  durations: [5],
  aspectRatios: ["16:9", "9:16", "1:1"],
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
  creditCost: 40,
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
  creditCost: 10,
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
  creditCost: 90,
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
  creditCost: 90,
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
// NEW SFW VIDEO MODELS
// ════════════════════════════════════════════════════════════════

const LUMA: ModelConfig = {
  id: "luma",
  name: "Luma",
  provider: "PIAPI",
  pipiConfig: {
    model: "luma",
    taskTypes: { T2V: "luma-video", I2V: "luma-video" },
    costKey: "luma",
  },
  tier: "STANDARD",
  creditCost: 850,
  creditCostTable: { "5": 850 },
  supportedModes: ["T2V", "I2V"],
  maxDuration: 5,
  maxResolution: "720p",
  supportsAudio: false,
  contentMode: "SFW",
  description: "Luma video generation. 5 seconds.",
  durations: [5],
  aspectRatios: ["16:9", "9:16", "1:1"],
  resolutions: [],
  supportsEndFrame: false,
};

const HAILUO: ModelConfig = {
  id: "hailuo",
  name: "Hailuo",
  provider: "PIAPI",
  pipiConfig: {
    model: "hailuo",
    taskTypes: { T2V: "hailuo-video", I2V: "hailuo-video" },
    costKey: "hailuo",
  },
  tier: "STANDARD",
  creditCost: 850,
  creditCostTable: { "5": 850 },
  supportedModes: ["T2V", "I2V"],
  maxDuration: 5,
  maxResolution: "720p",
  supportsAudio: false,
  contentMode: "SFW",
  description: "Hailuo video generation. 5 seconds.",
  durations: [5],
  aspectRatios: ["16:9", "9:16", "1:1"],
  resolutions: [],
  supportsEndFrame: false,
};

// ════════════════════════════════════════════════════════════════
// NEW NSFW VIDEO MODELS (Venice AI)
// ════════════════════════════════════════════════════════════════

const NSFW_LTX_20: ModelConfig = {
  id: "nsfw-ltx-2.0",
  name: "LTX 2.0 NSFW",
  provider: "VENICE",
  veniceConfig: {
    model: "ltx-2.0-text-to-video",
    costKey: "venice-ltx-20",
  },
  tier: "BUDGET",
  creditCost: 850,
  creditCostTable: { "5": 850 },
  supportedModes: ["T2V"],
  maxDuration: 5,
  maxResolution: "720p",
  supportsAudio: false,
  contentMode: "NSFW",
  description: "Fast NSFW video generation. 5 seconds.",
  durations: [5],
  aspectRatios: ["16:9", "9:16", "1:1"],
  resolutions: [],
  supportsEndFrame: false,
};

const NSFW_LONGCAT: ModelConfig = {
  id: "nsfw-longcat",
  name: "Longcat NSFW",
  provider: "VENICE",
  veniceConfig: {
    model: "longcat-text-to-video",
    costKey: "venice-longcat",
  },
  tier: "ULTRA",
  creditCost: 2100,
  creditCostTable: { "5": 2100 },
  supportedModes: ["T2V"],
  maxDuration: 5,
  maxResolution: "1080p",
  supportsAudio: false,
  contentMode: "NSFW",
  description: "Premium NSFW video. Highest quality.",
  durations: [5],
  aspectRatios: ["16:9", "9:16", "1:1"],
  resolutions: [],
  supportsEndFrame: false,
};

// ════════════════════════════════════════════════════════════════
// NEW IMAGE MODELS
// ════════════════════════════════════════════════════════════════

const FLUX_DEV: ModelConfig = {
  id: "flux-dev",
  name: "Flux Dev",
  provider: "PIAPI",
  pipiConfig: {
    model: "Qubico/flux1-dev",
    taskTypes: { T2I: "txt2img" },
    costKey: "flux-dev",
  },
  tier: "STANDARD",
  creditCost: 90,
  supportedModes: ["T2I"],
  maxDuration: 0,
  maxResolution: "1024px",
  supportsAudio: false,
  contentMode: "SFW",
  description: "High quality Flux generation. Slower but better.",
  durations: [],
  aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16"],
  resolutions: [],
  supportsEndFrame: false,
};

const NANO_BANANA: ModelConfig = {
  id: "gemini-2.5-flash-image",
  name: "Nano Banana",
  provider: "PIAPI",
  pipiConfig: {
    model: "gemini",
    taskTypes: { T2I: "gemini-2.5-flash-image" },
    costKey: "nano-banana",
  },
  tier: "ULTRA",
  creditCost: 150,
  supportedModes: ["T2I"],
  maxDuration: 0,
  maxResolution: "1024px",
  supportsAudio: false,
  contentMode: "SFW",
  description: "Gemini-powered image generation.",
  durations: [],
  aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16"],
  resolutions: [],
  supportsEndFrame: false,
};

const NANO_BANANA_2: ModelConfig = {
  id: "gemini-3.1-flash-image-preview",
  name: "Nano Banana 2",
  provider: "PIAPI",
  pipiConfig: {
    model: "gemini",
    taskTypes: { T2I: "nano-banana-2" },
    costKey: "nano-banana-2",
  },
  tier: "ULTRA",
  creditCost: 150,
  supportedModes: ["T2I"],
  maxDuration: 0,
  maxResolution: "1024px",
  supportsAudio: false,
  contentMode: "SFW",
  description: "Gemini-powered image generation.",
  durations: [],
  aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16"],
  resolutions: [],
  supportsEndFrame: false,
};

const NANO_BANANA_PRO: ModelConfig = {
  id: "gemini-3-pro-image-preview",
  name: "Nano Banana Pro",
  provider: "PIAPI",
  pipiConfig: {
    model: "gemini",
    taskTypes: { T2I: "nano-banana-pro" },
    costKey: "nano-banana-pro",
  },
  tier: "ULTRA",
  creditCost: 450,
  supportedModes: ["T2I"],
  maxDuration: 0,
  maxResolution: "1024px",
  supportsAudio: false,
  contentMode: "SFW",
  description: "Premium Gemini image. Highest quality.",
  durations: [],
  aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16"],
  resolutions: [],
  supportsEndFrame: false,
};

// ── NSFW Image Models (Venice AI) ──

const NSFW_Z_IMAGE: ModelConfig = {
  id: "z-image-turbo-nsfw",
  name: "Z-Image Turbo NSFW",
  provider: "VENICE",
  veniceConfig: {
    model: "z-image-turbo",
    costKey: "venice-z-image",
  },
  tier: "STANDARD",
  creditCost: 50,
  supportedModes: ["T2I"],
  maxDuration: 0,
  maxResolution: "1440px",
  supportsAudio: false,
  contentMode: "NSFW",
  description: "Fast NSFW photorealistic images.",
  durations: [],
  aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16"],
  resolutions: [],
  supportsEndFrame: false,
};

const NSFW_CHROMA: ModelConfig = {
  id: "chroma",
  name: "Chroma NSFW",
  provider: "VENICE",
  veniceConfig: {
    model: "chroma",
    costKey: "venice-chroma",
  },
  tier: "STANDARD",
  creditCost: 50,
  supportedModes: ["T2I"],
  maxDuration: 0,
  maxResolution: "1024px",
  supportsAudio: false,
  contentMode: "NSFW",
  description: "Artistic NSFW image generation.",
  durations: [],
  aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16"],
  resolutions: [],
  supportsEndFrame: false,
};

const NSFW_LUSTIFY_SDXL: ModelConfig = {
  id: "lustify-sdxl",
  name: "Lustify SDXL",
  provider: "VENICE",
  veniceConfig: {
    model: "lustify-sdxl",
    costKey: "venice-lustify",
  },
  tier: "STANDARD",
  creditCost: 50,
  supportedModes: ["T2I"],
  maxDuration: 0,
  maxResolution: "1024px",
  supportsAudio: false,
  contentMode: "NSFW",
  description: "SDXL-based NSFW generation.",
  durations: [],
  aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16"],
  resolutions: [],
  supportsEndFrame: false,
};

const NSFW_LUSTIFY_V7: ModelConfig = {
  id: "lustify-v7",
  name: "Lustify V7",
  provider: "VENICE",
  veniceConfig: {
    model: "lustify-v7",
    costKey: "venice-lustify",
  },
  tier: "STANDARD",
  creditCost: 50,
  supportedModes: ["T2I"],
  maxDuration: 0,
  maxResolution: "1024px",
  supportsAudio: false,
  contentMode: "NSFW",
  description: "Latest Lustify NSFW generation.",
  durations: [],
  aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16"],
  resolutions: [],
  supportsEndFrame: false,
};

const NSFW_WAI: ModelConfig = {
  id: "wai-illustrious",
  name: "WAI Illustrious",
  provider: "VENICE",
  veniceConfig: {
    model: "wai-Illustrious",       // Venice API uses capital I
    costKey: "venice-wai",
  },
  tier: "STANDARD",
  creditCost: 50,
  supportedModes: ["T2I"],
  maxDuration: 0,
  maxResolution: "1024px",
  supportsAudio: false,
  contentMode: "NSFW",
  description: "Anime-style NSFW generation.",
  durations: [],
  aspectRatios: ["1:1", "4:3", "3:4", "16:9", "9:16"],
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
  // New SFW Video
  [LUMA.id]: LUMA,
  [HAILUO.id]: HAILUO,
  // NSFW Video
  [WAN22_NSFW_T2V.id]: WAN22_NSFW_T2V,
  [WAN26_NSFW_T2V.id]: WAN26_NSFW_T2V,
  [WAN26_NSFW_I2V.id]: WAN26_NSFW_I2V,
  [NSFW_LTX_20.id]: NSFW_LTX_20,
  [NSFW_LONGCAT.id]: NSFW_LONGCAT,
  // Image — SFW
  [Z_IMAGE_TURBO.id]: Z_IMAGE_TURBO,
  [FLUX_SCHNELL.id]: FLUX_SCHNELL,
  [FLUX_DEV.id]: FLUX_DEV,
  [QWEN_IMAGE.id]: QWEN_IMAGE,
  [SEEDREAM_5.id]: SEEDREAM_5,
  [NANO_BANANA.id]: NANO_BANANA,
  [NANO_BANANA_2.id]: NANO_BANANA_2,
  [NANO_BANANA_PRO.id]: NANO_BANANA_PRO,
  // Image — NSFW (Venice AI)
  [NSFW_Z_IMAGE.id]: NSFW_Z_IMAGE,
  [NSFW_CHROMA.id]: NSFW_CHROMA,
  [NSFW_LUSTIFY_SDXL.id]: NSFW_LUSTIFY_SDXL,
  [NSFW_LUSTIFY_V7.id]: NSFW_LUSTIFY_V7,
  [NSFW_WAI.id]: NSFW_WAI,
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
 * Uses creditCostTable if available (keyed by "${duration}_${resolution}"),
 * falls back to flat creditCost for images or simple multiplier for video.
 * Audio surcharge is added on top when audio=true and model has audioCreditAddon.
 */
export function calculateCreditCost(modelId: string, durationSec: number, resolution?: string, audio: boolean = false): number {
  const model = getModelById(modelId);
  if (!model) throw new Error(`Unknown model: ${modelId}`);
  if (model.supportedModes.includes("T2I")) return model.creditCost;

  let baseCredits: number | undefined;

  // Try exact lookup in cost table: "5_720p" → 2100
  if (model.creditCostTable) {
    const res = resolution || "720p";
    const exactKey = `${durationSec}_${res}`;
    if (model.creditCostTable[exactKey] != null) {
      baseCredits = model.creditCostTable[exactKey];
    }

    // Try without resolution: "5" → 850
    if (baseCredits === undefined) {
      const durationKey = `${durationSec}`;
      if (model.creditCostTable[durationKey] != null) {
        baseCredits = model.creditCostTable[durationKey];
      }
    }

    // Interpolate from nearest entry — ceil to never undercharge
    if (baseCredits === undefined) {
      const tableKeys = Object.keys(model.creditCostTable)
        .filter((k) => k.endsWith(`_${res}`) || !k.includes("_"))
        .map((k) => ({ key: k, dur: parseInt(k) }))
        .filter((k) => !isNaN(k.dur))
        .sort((a, b) => a.dur - b.dur);

      if (tableKeys.length > 0) {
        const base = tableKeys[0];
        const baseCost = model.creditCostTable[base.key];
        const perSec = baseCost / base.dur;
        baseCredits = Math.ceil(perSec * durationSec);
        console.warn(`[credits] Interpolated cost for model=${modelId} dur=${durationSec}s res=${res}: ${baseCredits} credits`);
      }
    }
  }

  // Fallback: no cost table match — log so we catch misconfigured models
  if (baseCredits === undefined) {
    const durationMultiplier = Math.ceil(durationSec / 5);
    baseCredits = model.creditCost * durationMultiplier;
    console.warn(`[credits] Fallback cost for model=${modelId}: ${baseCredits} credits (no creditCostTable match)`);
  }

  // Add audio surcharge
  let audioCredits = 0;
  if (audio && model.audioCreditAddon) {
    audioCredits = model.audioCreditAddon[`${durationSec}`]
      ?? model.audioCreditAddon[`${Math.ceil(durationSec / 5) * 5}`]
      ?? 0;
    if (audioCredits === 0) {
      console.warn(`[credits] No audio addon entry for model=${modelId} dur=${durationSec}s`);
    }
  }

  return baseCredits + audioCredits;
}

/**
 * Get the PiAPI task type for a model given the generation mode.
 */
export function getPiApiTaskType(modelId: string, mode: ModelMode): string | undefined {
  const model = getModelById(modelId);
  if (!model?.pipiConfig) return undefined;
  return model.pipiConfig.taskTypes[mode];
}

/**
 * Get default model ID for a given mode and content preference.
 */
export function getDefaultModelId(mode: ModelMode, contentMode: "SFW" | "NSFW"): string {
  if (contentMode === "NSFW") {
    if (mode === "T2V") return "wan26-nsfw-t2v";
    if (mode === "I2V") return "wan26-nsfw-i2v";
    if (mode === "T2I") return "z-image-turbo-nsfw";
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
    BUDGET: "Budget",
    STANDARD: "Standard",
    ULTRA: "Ultra",
  };

  for (const tier of ["BUDGET", "STANDARD", "ULTRA"] as ModelTier[]) {
    const tierModels = models.filter((m) => m.tier === tier);
    if (tierModels.length > 0) {
      groups.push({ tier, label: tierLabels[tier], models: tierModels });
    }
  }

  return groups;
}
