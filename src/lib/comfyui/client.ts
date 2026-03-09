import { randomUUID } from "crypto";
import type { WorkflowType } from "@/generated/prisma/client";
import fs from "fs";
import path from "path";

/**
 * ComfyUI API client wrapping HTTP + WebSocket APIs.
 * Workflow-agnostic — works with any workflow JSON exported
 * from ComfyUI in API format (Dev Mode → Save API Format).
 */

function getBaseUrl(): string {
  const url = process.env.COMFYUI_API_URL;
  if (!url) throw new Error("COMFYUI_API_URL environment variable not set");
  return url.replace(/\/$/, "");
}

// ─── Image Upload ───

/**
 * Upload an image to ComfyUI's input directory.
 * Returns the filename as stored by ComfyUI (may differ from input).
 */
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
  return data.name; // The filename as stored by ComfyUI
}

// ─── Prompt Queue ───

export type QueueResult = {
  prompt_id: string;
};

/**
 * Queue a workflow prompt for execution.
 * Returns the prompt_id used to track progress and retrieve output.
 */
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

/**
 * Get the execution history for a prompt, including output filenames.
 */
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

/**
 * Download a generated output file from ComfyUI.
 * Returns raw bytes.
 */
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

/**
 * Connect to ComfyUI's WebSocket for real-time progress updates.
 * Returns a cleanup function to close the connection.
 */
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
          // Execution complete
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
  UPSCALE: "upscale.json",
  STYLE_TRANSFER: "style-transfer.json",
};

/**
 * Load a workflow template JSON file for a given workflow type.
 * Templates are stored in src/lib/comfyui/workflows/ and exported
 * from ComfyUI in API format.
 */
export function loadTemplate(workflowType: WorkflowType): Record<string, unknown> {
  const filename = WORKFLOW_FILE_MAP[workflowType];
  const filePath = path.join(__dirname, "workflows", filename);

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Workflow template not found: ${filename}. ` +
      `Place the API-format JSON in src/lib/comfyui/workflows/`
    );
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

// ─── Parameter Injection ───

export type WorkflowParams = {
  prompt?: string;
  negativePrompt?: string;
  seed?: number;
  inputImageFilename?: string;
  inputVideoFilename?: string;
  audioFilename?: string;
  width?: number;
  height?: number;
  numFrames?: number;
  steps?: number;
  cfg?: number;
  denoise?: number;
  faceRestoreVisibility?: number;
  expressionIntensity?: number;
  scaleFactor?: number;
};

/**
 * Node mapping — maps semantic parameter names to specific node IDs
 * within a workflow. This is workflow-specific and must be defined
 * per workflow template after Elijah exports the JSONs.
 *
 * Example:
 * {
 *   promptNode: "6",        // CLIPTextEncode node ID
 *   negativeNode: "7",      // Negative CLIPTextEncode
 *   samplerNode: "3",       // KSampler node ID
 *   imageLoaderNode: "10",  // LoadImage node ID
 *   latentNode: "5",        // EmptyLatentImage node ID
 * }
 */
export type NodeMapping = Record<string, string>;

/**
 * Inject dynamic parameters into a workflow template.
 * Modifies the workflow JSON in-place based on node mappings.
 *
 * Always randomizes seed to prevent ComfyUI caching.
 */
export function injectParams(
  workflow: Record<string, unknown>,
  params: WorkflowParams,
  nodeMapping: NodeMapping
): Record<string, unknown> {
  const w = JSON.parse(JSON.stringify(workflow)); // Deep clone

  // Always randomize seed
  const seed = params.seed ?? Math.floor(Math.random() * 2 ** 32);

  // Helper to set a node input value
  const setNodeInput = (nodeId: string, inputKey: string, value: unknown) => {
    const node = w[nodeId] as Record<string, unknown> | undefined;
    if (node?.inputs && typeof node.inputs === "object") {
      (node.inputs as Record<string, unknown>)[inputKey] = value;
    }
  };

  // Prompt text → text encoder node
  if (params.prompt && nodeMapping.promptNode) {
    setNodeInput(nodeMapping.promptNode, "text", params.prompt);
  }

  // Negative prompt
  if (params.negativePrompt && nodeMapping.negativeNode) {
    setNodeInput(nodeMapping.negativeNode, "text", params.negativePrompt);
  }

  // Seed → sampler node
  if (nodeMapping.samplerNode) {
    setNodeInput(nodeMapping.samplerNode, "seed", seed);
  }

  // Input image filename → LoadImage node
  if (params.inputImageFilename && nodeMapping.imageLoaderNode) {
    setNodeInput(nodeMapping.imageLoaderNode, "image", params.inputImageFilename);
  }

  // Input video filename → LoadVideo node
  if (params.inputVideoFilename && nodeMapping.videoLoaderNode) {
    setNodeInput(nodeMapping.videoLoaderNode, "video", params.inputVideoFilename);
  }

  // Audio filename → LoadAudio node
  if (params.audioFilename && nodeMapping.audioLoaderNode) {
    setNodeInput(nodeMapping.audioLoaderNode, "audio", params.audioFilename);
  }

  // Resolution → latent/image scale node
  if (nodeMapping.latentNode) {
    if (params.width) setNodeInput(nodeMapping.latentNode, "width", params.width);
    if (params.height) setNodeInput(nodeMapping.latentNode, "height", params.height);
  }

  // Frame count → sampler or video node
  if (params.numFrames && nodeMapping.samplerNode) {
    setNodeInput(nodeMapping.samplerNode, "num_frames", params.numFrames);
  }

  // Sampler parameters
  if (nodeMapping.samplerNode) {
    if (params.steps) setNodeInput(nodeMapping.samplerNode, "steps", params.steps);
    if (params.cfg) setNodeInput(nodeMapping.samplerNode, "cfg", params.cfg);
    if (params.denoise !== undefined) setNodeInput(nodeMapping.samplerNode, "denoise", params.denoise);
  }

  // Face restore visibility
  if (params.faceRestoreVisibility !== undefined && nodeMapping.faceRestoreNode) {
    setNodeInput(nodeMapping.faceRestoreNode, "visibility", params.faceRestoreVisibility);
  }

  // Expression intensity (talking head)
  if (params.expressionIntensity !== undefined && nodeMapping.expressionNode) {
    setNodeInput(nodeMapping.expressionNode, "intensity", params.expressionIntensity);
  }

  // Upscale factor
  if (params.scaleFactor && nodeMapping.upscaleNode) {
    setNodeInput(nodeMapping.upscaleNode, "scale_by", params.scaleFactor);
  }

  return w;
}
