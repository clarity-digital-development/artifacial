import type { WorkflowType } from "@/generated/prisma/client";

/**
 * Per-workflow node mappings for ComfyUI workflows.
 * Maps semantic parameter names to the actual node IDs in each workflow JSON.
 * Used by `injectParams()` in client.ts to dynamically set values at queue time.
 *
 * === Post-Processing Keys (A6000 ComfyUI) ===
 *   videoLoaderNode    — VHS_LoadVideo (input video)
 *   imageLoaderNode    — LoadImage (source face for face swap)
 *   sourceImageNode    — LoadImage (source face, legacy alias)
 *   audioLoaderNode    — LoadAudio (input audio)
 *   faceSwapNode       — ReActorFaceSwapOpt
 *   maskHelperNode     — ReActorMaskHelper (occlusion handling)
 *   deflickerNode      — Pixel Deflicker (temporal smoothing)
 *   rifeNode           — RIFE VFI (frame interpolation)
 *   upscaleModelNode   — UpscaleModelLoader
 *   upscaleNode        — ImageUpscaleWithModel or ImageScale
 *   downscaleNode      — ImageScale (Lanczos downscale to target)
 *   latentSyncNode     — D_LatentSyncNode (lip sync)
 *   vocalIsolateNode   — DeepExtract (Demucs vocal isolation)
 *   videoLengthNode    — VideoLengthAdjuster
 *   videoCombineNode   — VHS_VideoCombine (output)
 *   faceRestoreNode    — Face restore model ref (legacy)
 *
 * === Wan2.2 MoE Dual-Expert Keys (A100 generation) ===
 *   highNoiseModelNode, lowNoiseModelNode, highNoiseSamplerNode,
 *   lowNoiseSamplerNode, slgNode, torchCompileNode, wanTextEncodeNode,
 *   wanI2VEncodeNode, wanClipVisionNode, vaeLoaderNode
 *
 * === Phantom (T2V) ===
 *   phantomEncodeNode, phantomEmbedsNode
 *
 * === Animate (Motion Transfer — routes to A100) ===
 *   animateEmbedsNode, motionVideoNode
 *
 * === VACE (Style Transfer — routes to A100) ===
 *   vaceEncodeNode, vaceModelNode, styleImageNode
 */

export type NodeMapping = Record<string, string>;

export const NODE_MAPPINGS: Record<WorkflowType, NodeMapping> = {
  // ─── Face Swap (A6000 — ReActorFaceSwapOpt + MaskHelper + GPEN-BFR-512) ───
  // Peak VRAM: ~5-7 GB. Timeout: 5 min. Max retries: 2.
  FACE_SWAP: {
    videoLoaderNode: "1",        // VHS_LoadVideo
    imageLoaderNode: "2",        // LoadImage (source face)
    faceSwapNode: "3",           // ReActorFaceSwapOpt (reswapper_256 + GPEN + FaceBoost)
    maskHelperNode: "4",         // ReActorMaskHelper (YOLOv8m + SAM ViT-L)
    deflickerNode: "5",          // Pixel Deflicker (temporal smoothing)
    videoCombineNode: "6",       // VHS_VideoCombine
  },

  // ─── Upscale + Interpolation (A6000 — RIFE first, then NMKD-Siax 4x) ───
  // Peak VRAM: ~6-10 GB. Timeout: 15 min. Max retries: 1.
  UPSCALE: {
    videoLoaderNode: "1",        // VHS_LoadVideo
    rifeNode: "2",               // RIFE VFI v4.7 (16→32fps at 720p)
    upscaleModelNode: "3",       // UpscaleModelLoader (4x_NMKD-Siax_200k)
    upscaleNode: "4",            // ImageUpscaleWithModel (720p → 5120x2880)
    downscaleNode: "5",          // ImageScale (Lanczos → 1920x1080)
    videoCombineNode: "6",       // VHS_VideoCombine (30fps, CRF 18)
  },

  // ─── Lip Sync (A6000 — LatentSync 1.6 + DeepExtract vocal isolation) ───
  // Peak VRAM: ~18-24 GB. Timeout: 10 min. Max retries: 2.
  // Hard limit: 150 frames at 25fps = 6 seconds max.
  LIP_SYNC: {
    videoLoaderNode: "1",        // VHS_LoadVideo (25fps, frame_load_cap: 150)
    audioLoaderNode: "2",        // LoadAudio
    vocalIsolateNode: "3",       // DeepExtract (Demucs vocal isolation)
    videoLengthNode: "4",        // VideoLengthAdjuster (LoopToAudio)
    latentSyncNode: "5",         // D_LatentSyncNode (diffusion UNet + Whisper)
    videoCombineNode: "6",       // VHS_VideoCombine (25fps)
  },

  // ─── Image to Video (A100 — Wan2.2 MoE I2V) ───
  IMAGE_TO_VIDEO: {
    highNoiseModelNode: "1",
    lowNoiseModelNode: "2",
    vaeLoaderNode: "3",
    imageLoaderNode: "6",
    wanClipVisionNode: "7",
    wanTextEncodeNode: "8",
    wanI2VEncodeNode: "9",
    slgNode: "10",
    torchCompileNode: "11",
    highNoiseSamplerNode: "12",
    lowNoiseSamplerNode: "13",
    videoCombineNode: "15",
  },

  // ─── Text to Video (A100 — Wan2.2 MoE I2V + Phantom face identity) ───
  TEXT_TO_VIDEO: {
    highNoiseModelNode: "1",
    lowNoiseModelNode: "2",
    vaeLoaderNode: "3",
    imageLoaderNode: "6",
    wanClipVisionNode: "7",
    wanTextEncodeNode: "8",
    wanI2VEncodeNode: "9",
    phantomEncodeNode: "10",
    phantomEmbedsNode: "11",
    torchCompileNode: "12",
    slgNode: "13",
    highNoiseSamplerNode: "14",
    lowNoiseSamplerNode: "15",
    videoCombineNode: "17",
  },

  // ─── Motion Transfer (A100 — Wan2.2-Animate via Diffusers) ───
  MOTION_TRANSFER: {
    highNoiseModelNode: "1",
    lowNoiseModelNode: "2",
    vaeLoaderNode: "3",
    imageLoaderNode: "6",
    motionVideoNode: "7",
    wanClipVisionNode: "8",
    animateEmbedsNode: "9",
    torchCompileNode: "10",
    wanTextEncodeNode: "11",
    slgNode: "12",
    highNoiseSamplerNode: "13",
    lowNoiseSamplerNode: "14",
    videoCombineNode: "16",
  },

  // ─── Talking Head (A100 — InfiniteTalk via Wan2.1 I2V) ───
  TALKING_HEAD: {
    highNoiseModelNode: "1",
    lowNoiseModelNode: "2",
    vaeLoaderNode: "3",
    imageLoaderNode: "6",
    audioLoaderNode: "7",
    wanClipVisionNode: "8",
    wanTextEncodeNode: "9",
    torchCompileNode: "10",
    wanI2VEncodeNode: "11",
    slgNode: "12",
    highNoiseSamplerNode: "13",
    lowNoiseSamplerNode: "14",
    videoCombineNode: "16",
  },

  // ─── Style Transfer (A100 — Wan-VACE via Diffusers) ───
  // A6000 alternative: ComfyUI-ProPost LUT/color grading (deterministic, zero-VRAM)
  STYLE_TRANSFER: {
    highNoiseModelNode: "1",
    lowNoiseModelNode: "2",
    vaeLoaderNode: "3",
    styleImageNode: "5",
    imageLoaderNode: "6",
    wanClipVisionNode: "8",
    vaceEncodeNode: "9",
    wanI2VEncodeNode: "10",
    torchCompileNode: "11",
    wanTextEncodeNode: "12",
    slgNode: "13",
    highNoiseSamplerNode: "14",
    lowNoiseSamplerNode: "15",
    videoCombineNode: "17",
    vaceModelNode: "20",
  },

  // Not a ComfyUI workflow — handled by self-hosted Diffusers
  TEXT_TO_IMAGE: {},
};
