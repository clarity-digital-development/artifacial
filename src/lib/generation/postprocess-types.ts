import type { WorkflowType } from "@/generated/prisma/client";

// ─── A6000 post-processing types (ComfyUI workflows) ───

export const POST_PROCESS_TYPES = [
  "FACE_SWAP",
  "UPSCALE",
  "LIP_SYNC",
  "STYLE_TRANSFER",
] as const;

export type PostProcessType = (typeof POST_PROCESS_TYPES)[number];

export function isPostProcessType(value: string): value is PostProcessType {
  return POST_PROCESS_TYPES.includes(value as PostProcessType);
}

/** Map post-process type to WorkflowType enum */
export const POST_PROCESS_WORKFLOW_MAP: Record<PostProcessType, WorkflowType> = {
  FACE_SWAP: "FACE_SWAP",
  UPSCALE: "UPSCALE",
  LIP_SYNC: "LIP_SYNC",
  STYLE_TRANSFER: "STYLE_TRANSFER",
};

/** Credit costs per post-process operation */
export const POST_PROCESS_CREDITS: Record<PostProcessType, number> = {
  UPSCALE: 1,      // Cheapest — fast, reliable, ~15-25s
  FACE_SWAP: 1,    // ~2-6 min, 5-15% failure rate
  LIP_SYNC: 1,     // ~90s, 10-20% failure rate
  STYLE_TRANSFER: 1, // Disabled in UI until Wan-VACE on A100 or LUT workflow on A6000
};

/**
 * Processing estimates per workflow type.
 * Used for UI display and timeout calibration.
 */
export const POST_PROCESS_INFO: Record<PostProcessType, {
  estimatedTimeSec: string;
  peakVramGB: string;
  failureRate: string;
  maxDurationSec: number;
  notes: string;
}> = {
  FACE_SWAP: {
    estimatedTimeSec: "120-360",
    peakVramGB: "5-7",
    failureRate: "5-15%",
    maxDurationSec: 10,
    notes: "ReSwapper 256 (commercial-safe) + GPEN-BFR-512 + SAM occlusion masking",
  },
  UPSCALE: {
    estimatedTimeSec: "15-25",
    peakVramGB: "6-10",
    failureRate: "3-10%",
    maxDurationSec: 10,
    notes: "RIFE v4.7 interpolation (16→30fps) + NMKD-Siax 4x upscale + Lanczos to 1080p",
  },
  LIP_SYNC: {
    estimatedTimeSec: "90",
    peakVramGB: "18-24",
    failureRate: "10-20%",
    maxDurationSec: 6, // 150 frames at 25fps = 6 seconds max (LatentSync hard limit)
    notes: "LatentSync 1.6 (diffusion UNet + Whisper). 150-frame cap. Clean vocal audio required.",
  },
  STYLE_TRANSFER: {
    estimatedTimeSec: "N/A",
    peakVramGB: "N/A",
    failureRate: "N/A",
    maxDurationSec: 10,
    notes: "Disabled. Wan-VACE (A100) for AI style transfer. LUT/color grading (A6000) planned for v2.",
  },
};

/** Job payload pushed to the postprocess-queue Redis list */
export type PostProcessJob = {
  generationId: string;
  parentGenerationId: string;
  userId: string;
  type: PostProcessType;
  sourceVideoR2Key: string;
  creditsCost: number;
  params: PostProcessParams;
};

export type PostProcessParams = {
  // FACE_SWAP
  faceImageR2Key?: string;

  // UPSCALE
  targetResolution?: string;

  // LIP_SYNC
  audioFileR2Key?: string;

  // STYLE_TRANSFER (disabled — future use)
  stylePrompt?: string;
};
