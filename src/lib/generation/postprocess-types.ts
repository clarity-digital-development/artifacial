import type { WorkflowType } from "@/generated/prisma/client";

// ─── PiAPI post-processing types ───

export const POST_PROCESS_TYPES = [
  "FACE_SWAP",
  "VIDEO_FACE_SWAP",
  "UPSCALE",
  "BACKGROUND_REMOVAL",
  "VIRTUAL_TRY_ON",
  "AI_HUG",
] as const;

export type PostProcessType = (typeof POST_PROCESS_TYPES)[number];

export function isPostProcessType(value: string): value is PostProcessType {
  return POST_PROCESS_TYPES.includes(value as PostProcessType);
}

/** Map post-process type to WorkflowType enum */
export const POST_PROCESS_WORKFLOW_MAP: Record<PostProcessType, WorkflowType> = {
  FACE_SWAP: "FACE_SWAP",
  VIDEO_FACE_SWAP: "FACE_SWAP",
  UPSCALE: "UPSCALE",
  BACKGROUND_REMOVAL: "BACKGROUND_REMOVAL",
  VIRTUAL_TRY_ON: "VIRTUAL_TRY_ON",
  AI_HUG: "AI_HUG",
};

/** Credit costs per post-process operation (1 credit = $0.00025) */
export const POST_PROCESS_CREDITS: Record<PostProcessType, number> = {
  FACE_SWAP: 40,            // $0.01 per swap — PiAPI image toolkit
  VIDEO_FACE_SWAP: 2400,    // ~$0.60 per 5s video (~150 frames × $0.004) — PiAPI video toolkit
  UPSCALE: 40,              // ~$0.01 est. — not yet implemented via PiAPI
  BACKGROUND_REMOVAL: 5,    // $0.001 per image — PiAPI image toolkit
  VIRTUAL_TRY_ON: 280,      // $0.07 per output — Kling virtual try-on
  AI_HUG: 80,               // ~$0.02 — PiAPI hug-video
};

/**
 * Processing estimates per workflow type.
 * PiAPI handles all processing — no local GPU needed.
 */
export const POST_PROCESS_INFO: Record<PostProcessType, {
  estimatedTimeSec: string;
  notes: string;
}> = {
  FACE_SWAP: {
    estimatedTimeSec: "5-15",
    notes: "PiAPI image toolkit face-swap. Max 2048x2048.",
  },
  VIDEO_FACE_SWAP: {
    estimatedTimeSec: "30-120",
    notes: "PiAPI video toolkit face-swap. Max 720p, 600 frames, 10MB.",
  },
  UPSCALE: {
    estimatedTimeSec: "10-30",
    notes: "Video upscale via PiAPI (when available).",
  },
  BACKGROUND_REMOVAL: {
    estimatedTimeSec: "3-10",
    notes: "PiAPI image toolkit bg-remove. RMBG-2.0 model.",
  },
  VIRTUAL_TRY_ON: {
    estimatedTimeSec: "15-30",
    notes: "Kling virtual try-on. Supports single or multi-garment.",
  },
  AI_HUG: {
    estimatedTimeSec: "30-60",
    notes: "PiAPI hug-video. Generates hugging animation from image.",
  },
};

/** Job payload for PiAPI post-processing */
export type PostProcessJob = {
  generationId: string;
  parentGenerationId: string;
  userId: string;
  type: PostProcessType;
  sourceMediaR2Key: string;
  creditsCost: number;
  params: PostProcessParams;
};

export type PostProcessParams = {
  // FACE_SWAP / VIDEO_FACE_SWAP
  faceImageR2Key?: string;

  // BACKGROUND_REMOVAL
  bgModel?: "RMBG-1.4" | "RMBG-2.0" | "BEN2";

  // VIRTUAL_TRY_ON
  dressImageUrl?: string;
  upperImageUrl?: string;
  lowerImageUrl?: string;

  // AI_HUG
  sourceImageUrl?: string;
};
