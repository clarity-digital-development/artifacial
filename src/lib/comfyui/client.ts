import { randomUUID } from "crypto";
import type { WorkflowType } from "@/generated/prisma/client";
import fs from "fs";
import path from "path";
import { NODE_MAPPINGS } from "./node-mappings";

/**
 * ComfyUI API client for Wan2.2 MoE dual-expert architecture.
 *
 * Key changes from Wan2.1:
 *  - Dual model loaders (high-noise + low-noise experts)
 *  - Split-step sampling: high-noise expert (steps 0→N) + low-noise expert (steps N→end)
 *  - SLG (Skip Layer Guidance) on both samplers
 *  - Torch compile settings piped to both model loaders
 *  - Phantom face identity embeds (T2V)
 *  - WanVideoAnimateEmbeds (motion transfer)
 *  - WanVideoVACEEncode (style transfer)
 *  - Mandatory post-processing: CodeFormer → RealESRGAN → RIFE
 */

function getBaseUrl(): string {
  const url = process.env.COMFYUI_API_URL;
  if (!url) throw new Error("COMFYUI_API_URL environment variable not set");
  return url.replace(/\/$/, "");
}

// ─── File Upload ───

export async function uploadImage(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const formData = new FormData();
  formData.append("image", new Blob([new Uint8Array(buffer)]), filename);
  formData.append("overwrite", "true");

  const res = await fetch(`${getBaseUrl()}/upload/image`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ComfyUI upload failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.name;
}

export async function uploadVideo(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const formData = new FormData();
  formData.append("image", new Blob([new Uint8Array(buffer)]), filename);
  formData.append("overwrite", "true");
  formData.append("type", "input");
  formData.append("subfolder", "");

  const res = await fetch(`${getBaseUrl()}/upload/image`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ComfyUI video upload failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.name;
}

export async function uploadAudio(
  buffer: Buffer,
  filename: string
): Promise<string> {
  const formData = new FormData();
  formData.append("image", new Blob([new Uint8Array(buffer)]), filename);
  formData.append("overwrite", "true");
  formData.append("type", "input");
  formData.append("subfolder", "");

  const res = await fetch(`${getBaseUrl()}/upload/image`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ComfyUI audio upload failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.name;
}

// ─── VRAM Management ───

/**
 * Call POST /free to release VRAM between jobs.
 * ComfyUI leaks memory across executions — without this,
 * VRAM accumulates and OOMs after 3-4 face swap jobs.
 */
export async function freeVram(unloadModels: boolean = false): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/free`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      unload_models: unloadModels,
      free_memory: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn(`ComfyUI /free failed (${res.status}): ${text}`);
  }
}

/**
 * Get system stats from ComfyUI for memory monitoring.
 * Used to detect when VRAM or RAM is running low and trigger restart.
 */
export async function getSystemStats(): Promise<{
  vramFreeGB: number;
  vramTotalGB: number;
  ramFreeGB: number;
  ramTotalGB: number;
} | null> {
  try {
    const res = await fetch(`${getBaseUrl()}/system_stats`);
    if (!res.ok) return null;
    const data = await res.json();
    const gpu = data.devices?.[0];
    const system = data.system;
    return {
      vramFreeGB: gpu ? (gpu.vram_total - gpu.vram_used) / 1e9 : 0,
      vramTotalGB: gpu ? gpu.vram_total / 1e9 : 0,
      ramFreeGB: system ? system.ram_free / 1e9 : 0,
      ramTotalGB: system ? system.ram_total / 1e9 : 0,
    };
  } catch {
    return null;
  }
}

// ─── Prompt Queue ───

export type QueueResult = {
  prompt_id: string;
};

export async function queuePrompt(
  workflow: Record<string, unknown>,
  clientId?: string
): Promise<QueueResult> {
  const cid = clientId ?? randomUUID();

  const res = await fetch(`${getBaseUrl()}/prompt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: workflow,
      client_id: cid,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ComfyUI queue failed (${res.status}): ${text}`);
  }

  return res.json();
}

// ─── History / Output Retrieval ───

export type HistoryOutput = {
  filename: string;
  subfolder: string;
  type: string;
};

export async function getHistory(promptId: string): Promise<{
  outputs: Record<string, { images?: HistoryOutput[]; gifs?: HistoryOutput[] }>;
  status: { completed: boolean };
} | null> {
  const res = await fetch(`${getBaseUrl()}/history/${promptId}`);
  if (!res.ok) return null;

  const data = await res.json();
  const entry = data[promptId];
  if (!entry) return null;

  return {
    outputs: entry.outputs ?? {},
    status: { completed: entry.status?.completed ?? false },
  };
}

export async function getOutput(
  filename: string,
  subfolder: string = "",
  type: string = "output"
): Promise<Buffer> {
  const params = new URLSearchParams({ filename, subfolder, type });
  const res = await fetch(`${getBaseUrl()}/view?${params}`);

  if (!res.ok) {
    throw new Error(`ComfyUI output download failed (${res.status})`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ─── WebSocket Progress Monitoring ───

export type ProgressCallback = (data: {
  type: string;
  value?: number;
  max?: number;
  promptId?: string;
}) => void;

export function connectWebSocket(
  clientId: string,
  onProgress: ProgressCallback
): { close: () => void } {
  const wsUrl = getBaseUrl().replace(/^http/, "ws");
  const ws = new WebSocket(`${wsUrl}/ws?clientId=${clientId}`);

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data as string);
      if (msg.type === "progress") {
        onProgress({
          type: "progress",
          value: msg.data?.value,
          max: msg.data?.max,
          promptId: msg.data?.prompt_id,
        });
      } else if (msg.type === "executing") {
        if (msg.data?.node === null) {
          onProgress({
            type: "complete",
            promptId: msg.data?.prompt_id,
          });
        } else {
          onProgress({
            type: "executing",
            promptId: msg.data?.prompt_id,
          });
        }
      } else if (msg.type === "execution_error") {
        onProgress({
          type: "error",
          promptId: msg.data?.prompt_id,
        });
      }
    } catch {
      // Ignore malformed messages
    }
  };

  return {
    close: () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    },
  };
}

// ─── Workflow Template Loading ───

const WORKFLOW_FILE_MAP: Record<WorkflowType, string> = {
  FACE_SWAP: "face-swap.json",
  IMAGE_TO_VIDEO: "image-to-video.json",
  TEXT_TO_VIDEO: "text-to-video.json",
  MOTION_TRANSFER: "motion-transfer.json",
  TALKING_HEAD: "talking-head.json",
  LIP_SYNC: "lip-sync.json",
  UPSCALE: "upscale.json",
  STYLE_TRANSFER: "style-transfer.json",
  TEXT_TO_IMAGE: "", // Not a ComfyUI workflow — handled by self-hosted Diffusers
};

export function loadTemplate(workflowType: WorkflowType): Record<string, unknown> {
  const filename = WORKFLOW_FILE_MAP[workflowType];
  const filePath = path.join(__dirname, "workflows", filename);

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Workflow template not found for ${workflowType} — ` +
      `expected ${filename} in src/lib/comfyui/workflows/. ` +
      `Export the API-format JSON from ComfyUI and place it there.`
    );
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

// ─── Parameter Injection ───

export type WorkflowParams = {
  // Core prompts
  prompt?: string;
  negativePrompt?: string;
  seed?: number;

  // Input files
  inputImageFilename?: string;
  inputVideoFilename?: string;
  audioFilename?: string;
  sourceImageFilename?: string;   // Source face for face swap
  styleImageFilename?: string;    // Style reference for style transfer
  motionVideoFilename?: string;   // Motion reference for motion transfer

  // Resolution & duration
  width?: number;
  height?: number;
  numFrames?: number;

  // Wan2.2 MoE sampler params
  steps?: number;                 // Total steps (split between high/low noise)
  highNoiseSteps?: number;        // Steps for high-noise expert (default: 14)
  cfg?: number;                   // CFG scale (default: 5.0)
  shift?: number;                 // Sampler shift (default: 5.0)

  // SLG
  slgBlocks?: string;             // SLG blocks to skip uncond on (default: "9")
  slgStartPercent?: number;       // SLG start percent (default: 0.1)
  slgEndPercent?: number;         // SLG end percent (default: 1.0)

  // Phantom (T2V face identity)
  phantomCfgScale?: number;       // Phantom CFG scale (default: 5.0)
  phantomStartPercent?: number;   // Phantom start percent (default: 0.0)
  phantomEndPercent?: number;     // Phantom end percent (default: 1.0)

  // Animate (motion transfer)
  poseStrength?: number;          // Animate pose strength (default: 1.0)
  faceStrength?: number;          // Animate face strength (default: 1.0)
  frameWindowSize?: number;       // Animate frame window (default: 77)

  // VACE (style transfer)
  vaceStrength?: number;          // VACE conditioning strength (default: 0.85)

  // Face / expression (legacy)
  faceRestoreVisibility?: number;
  codeformerWeight?: number;      // CodeFormer fidelity weight (default: 0.7)

  // Upscale
  scaleFactor?: number;

  // Frame rate for output video
  frameRate?: number;

  // Denoise strength for V2V workflows
  denoise?: number;
};

export type NodeMapping = Record<string, string>;

/**
 * Helper to set a value on a node's inputs object.
 */
function setNodeInput(
  workflow: Record<string, unknown>,
  nodeId: string,
  inputKey: string,
  value: unknown
) {
  const node = workflow[nodeId] as Record<string, unknown> | undefined;
  if (node?.inputs && typeof node.inputs === "object") {
    (node.inputs as Record<string, unknown>)[inputKey] = value;
  }
}

/**
 * Inject dynamic parameters into a Wan2.2 workflow template.
 * Deep-clones the template, then applies all relevant parameters
 * using the node mapping for the given workflow type.
 *
 * Always randomizes seed to prevent ComfyUI caching.
 */
export function injectParams(
  workflow: Record<string, unknown>,
  params: WorkflowParams,
  workflowType: WorkflowType
): Record<string, unknown> {
  const w = JSON.parse(JSON.stringify(workflow)); // Deep clone
  const mapping = NODE_MAPPINGS[workflowType];

  if (!mapping) {
    throw new Error(`No node mapping defined for workflow type: ${workflowType}`);
  }

  const seed = params.seed ?? Math.floor(Math.random() * 2 ** 32);
  const totalSteps = params.steps ?? 24;
  const highNoiseSteps = params.highNoiseSteps ?? 14;
  const cfg = params.cfg ?? 5.0;
  const shift = params.shift ?? 5.0;

  const set = (nodeId: string, key: string, value: unknown) =>
    setNodeInput(w, nodeId, key, value);

  // ─── Wan2.2 MoE Dual-Expert Samplers ───
  if (mapping.highNoiseSamplerNode) {
    set(mapping.highNoiseSamplerNode, "seed", seed);
    set(mapping.highNoiseSamplerNode, "steps", totalSteps);
    set(mapping.highNoiseSamplerNode, "cfg", cfg);
    set(mapping.highNoiseSamplerNode, "shift", shift);
    set(mapping.highNoiseSamplerNode, "start_step", 0);
    set(mapping.highNoiseSamplerNode, "end_step", highNoiseSteps);
  }
  if (mapping.lowNoiseSamplerNode) {
    set(mapping.lowNoiseSamplerNode, "seed", seed);
    set(mapping.lowNoiseSamplerNode, "steps", totalSteps);
    set(mapping.lowNoiseSamplerNode, "cfg", cfg);
    set(mapping.lowNoiseSamplerNode, "shift", shift);
    set(mapping.lowNoiseSamplerNode, "start_step", highNoiseSteps);
    set(mapping.lowNoiseSamplerNode, "end_step", -1);
  }

  // ─── SLG ───
  if (mapping.slgNode) {
    if (params.slgBlocks) set(mapping.slgNode, "blocks", params.slgBlocks);
    if (params.slgStartPercent !== undefined) set(mapping.slgNode, "start_percent", params.slgStartPercent);
    if (params.slgEndPercent !== undefined) set(mapping.slgNode, "end_percent", params.slgEndPercent);
  }

  // ─── Wan Text Encode (positive_prompt + negative_prompt in one node) ───
  if (mapping.wanTextEncodeNode) {
    if (params.prompt) set(mapping.wanTextEncodeNode, "positive_prompt", params.prompt);
    if (params.negativePrompt) set(mapping.wanTextEncodeNode, "negative_prompt", params.negativePrompt);
  }

  // ─── Wan I2V Encode (resolution + frame count) ───
  if (mapping.wanI2VEncodeNode) {
    if (params.width) set(mapping.wanI2VEncodeNode, "width", params.width);
    if (params.height) set(mapping.wanI2VEncodeNode, "height", params.height);
    if (params.numFrames) set(mapping.wanI2VEncodeNode, "num_frames", params.numFrames);
  }

  // ─── Phantom Face Identity (T2V) ───
  if (mapping.phantomEmbedsNode) {
    if (params.numFrames) set(mapping.phantomEmbedsNode, "num_frames", params.numFrames);
    if (params.phantomCfgScale !== undefined) set(mapping.phantomEmbedsNode, "phantom_cfg_scale", params.phantomCfgScale);
    if (params.phantomStartPercent !== undefined) set(mapping.phantomEmbedsNode, "phantom_start_percent", params.phantomStartPercent);
    if (params.phantomEndPercent !== undefined) set(mapping.phantomEmbedsNode, "phantom_end_percent", params.phantomEndPercent);
  }

  // ─── Animate Embeds (Motion Transfer) ───
  if (mapping.animateEmbedsNode) {
    if (params.width) set(mapping.animateEmbedsNode, "width", params.width);
    if (params.height) set(mapping.animateEmbedsNode, "height", params.height);
    if (params.numFrames) set(mapping.animateEmbedsNode, "num_frames", params.numFrames);
    if (params.poseStrength !== undefined) set(mapping.animateEmbedsNode, "pose_strength", params.poseStrength);
    if (params.faceStrength !== undefined) set(mapping.animateEmbedsNode, "face_strength", params.faceStrength);
    if (params.frameWindowSize) set(mapping.animateEmbedsNode, "frame_window_size", params.frameWindowSize);
  }

  // ─── VACE Encode (Style Transfer) ───
  if (mapping.vaceEncodeNode) {
    if (params.width) set(mapping.vaceEncodeNode, "width", params.width);
    if (params.height) set(mapping.vaceEncodeNode, "height", params.height);
    if (params.numFrames) set(mapping.vaceEncodeNode, "num_frames", params.numFrames);
    if (params.vaceStrength !== undefined) set(mapping.vaceEncodeNode, "strength", params.vaceStrength);
  }

  // ─── Input files ───
  if (params.inputImageFilename && mapping.imageLoaderNode) {
    set(mapping.imageLoaderNode, "image", params.inputImageFilename);
  }
  if (params.inputVideoFilename && mapping.videoLoaderNode) {
    set(mapping.videoLoaderNode, "video", params.inputVideoFilename);
  }
  if (params.audioFilename && mapping.audioLoaderNode) {
    set(mapping.audioLoaderNode, "audio_file", params.audioFilename);
  }
  if (params.sourceImageFilename && mapping.sourceImageNode) {
    set(mapping.sourceImageNode, "image", params.sourceImageFilename);
  }
  if (params.styleImageFilename && mapping.styleImageNode) {
    set(mapping.styleImageNode, "image", params.styleImageFilename);
  }
  if (params.motionVideoFilename && mapping.motionVideoNode) {
    set(mapping.motionVideoNode, "video", params.motionVideoFilename);
  }

  // ─── Face restore (CodeFormer in upscale, ReActor in face swap) ───
  if (params.faceRestoreVisibility !== undefined && mapping.faceRestoreNode) {
    set(mapping.faceRestoreNode, "face_restore_visibility", params.faceRestoreVisibility);
  }
  if (params.codeformerWeight !== undefined && mapping.faceRestoreNode) {
    set(mapping.faceRestoreNode, "codeformer_weight", params.codeformerWeight);
  }

  // ─── Upscale factor ───
  if (params.scaleFactor && mapping.upscaleNode) {
    set(mapping.upscaleNode, "scale_by", params.scaleFactor);
  }

  // ─── Output frame rate ───
  if (params.frameRate && mapping.videoCombineNode) {
    set(mapping.videoCombineNode, "frame_rate", params.frameRate);
  }

  // ─── Denoise (V2V workflows) ───
  if (params.denoise !== undefined) {
    if (mapping.highNoiseSamplerNode) {
      set(mapping.highNoiseSamplerNode, "denoise_strength", params.denoise);
    }
  }

  return w;
}

// ─── High-Level Pipeline ───

export function prepareWorkflow(
  workflowType: WorkflowType,
  params: WorkflowParams
): Record<string, unknown> {
  const template = loadTemplate(workflowType);
  return injectParams(template, params, workflowType);
}

export async function executeWorkflow(
  workflowType: WorkflowType,
  params: WorkflowParams,
  clientId?: string
): Promise<QueueResult> {
  const workflow = prepareWorkflow(workflowType, params);
  return queuePrompt(workflow, clientId);
}

// Re-export node mappings for external use
export { NODE_MAPPINGS } from "./node-mappings";
