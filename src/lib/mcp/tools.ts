/**
 * MCP tool definitions for the Artifacial server.
 *
 * Each tool has:
 * - `name`            — invoked by `tools/call`
 * - `title`           — human-friendly display label
 * - `description`     — model-facing description (LLMs use this to decide WHEN to call)
 * - `inputSchema`     — JSON Schema (Draft 2020-12 subset) constraining `arguments`
 * - `handler(userId, args)` — the actual work; returns `MCPToolResult`
 *
 * Async generations: handlers that submit a long-running job (image/video) deduct
 * credits up-front, return `{ generationId, status: "processing" }`, and let the
 * client poll via the `get_generation` tool. Synchronous tools (virality
 * predictor) return the full result inline.
 */

import { prisma } from "@/lib/db";
import { getAvailableCredits, deductCredits, refundCredits } from "@/lib/credits";
import { WORKSHOP_TOOLS } from "@/lib/workshop/tools";
import { submitTask } from "@/lib/piapi-client";
import { submitRecraftCrispUpscale, submitTopazImageUpscale } from "@/lib/kieai";
import { analyzeVirality } from "@/lib/analysis/virality";
import { safeFetchUserUrl } from "@/lib/security/safe-fetch";
import { sanitizeClientError } from "@/lib/errors";
import { getSignedR2Url } from "@/lib/r2";
import type { Prisma } from "@/generated/prisma/client";
import { randomUUID } from "crypto";

// ─── Response type ───────────────────────────────────────────────────────────

export type MCPContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

export interface MCPToolResult {
  content: MCPContentBlock[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

interface MCPTool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (userId: string, args: Record<string, unknown>) => Promise<MCPToolResult>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function textResult(text: string, structured?: Record<string, unknown>): MCPToolResult {
  return {
    content: [{ type: "text", text }],
    ...(structured ? { structuredContent: structured } : {}),
  };
}

function errorResult(message: string): MCPToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

// Common Generation row constructor used by async tools so MCP-initiated jobs
// land in /gallery and recent generations exactly like Workshop UI ones.
async function createMCPGeneration(opts: {
  userId: string;
  toolName: string;
  workflowType: "TEXT_TO_IMAGE" | "IMAGE_EDIT" | "UPSCALE" | "IMAGE_TO_VIDEO" | "FACE_SWAP";
  modelId: string;
  credits: number;
  inputParams: Record<string, unknown>;
}): Promise<string> {
  const gen = await prisma.generation.create({
    data: {
      userId: opts.userId,
      workflowType: opts.workflowType,
      status: "PROCESSING",
      contentMode: "SFW",
      provider: "PIAPI",
      modelId: opts.modelId,
      creditsCost: opts.credits,
      withAudio: false,
      inputParams: { ...opts.inputParams, submissionPath: "mcp" } as Prisma.InputJsonValue,
      startedAt: new Date(),
      queuedAt: new Date(),
    },
    select: { id: true },
  });
  return gen.id;
}

// ─── Tool definitions ────────────────────────────────────────────────────────

const TOOLS: MCPTool[] = [
  // ── 1. Credits balance ─────────────────────────────────────────────────────
  {
    name: "get_credits",
    title: "Get credit balance",
    description:
      "Return the current Artifacial credit balance for the authenticated user. Returns subscription + purchased credits separately and a total.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    handler: async (userId) => {
      const { subscription, purchased, total } = await getAvailableCredits(userId);
      return textResult(
        `subscription: ${subscription} cr · purchased: ${purchased} cr · total: ${total} cr`,
        { subscription, purchased, total },
      );
    },
  },

  // ── 2. List workshop tools ─────────────────────────────────────────────────
  {
    name: "list_workshop_tools",
    title: "List workshop tools",
    description:
      "Return the catalog of every Artifacial workshop tool: slug, name, category, credits cost, and description. Useful when the user wants to know what generation tools are available.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          enum: ["video", "image", "face", "audio"],
          description: "Optional filter — only return tools in this category.",
        },
      },
      additionalProperties: false,
    },
    handler: async (_userId, args) => {
      const category = asString(args.category);
      const filtered = category ? WORKSHOP_TOOLS.filter((t) => t.category === category) : WORKSHOP_TOOLS;
      const list = filtered.map((t) => ({
        slug: t.slug,
        name: t.name,
        category: t.category,
        credits: t.credits,
        tagline: t.tagline,
        outputType: t.outputType,
      }));
      const text = list.map((t) => `• ${t.slug} (${t.category}, ${t.credits} cr) — ${t.tagline}`).join("\n");
      return textResult(text || "No tools match that category.", { tools: list, total: list.length });
    },
  },

  // ── 3. Recent generations ──────────────────────────────────────────────────
  {
    name: "list_recent_generations",
    title: "List recent generations",
    description:
      "Return the user's 20 most recent Artifacial generations across the workshop and /generate page. Includes status, output URL (if completed), thumbnail, and modelId. Use this to check what the user has been creating.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
        status: {
          type: "string",
          enum: ["PROCESSING", "COMPLETED", "FAILED"],
          description: "Optional — only return generations in this status.",
        },
      },
      additionalProperties: false,
    },
    handler: async (userId, args) => {
      const limit = Math.min(50, Math.max(1, Number(args.limit) || 20));
      const status = asString(args.status);
      const rows = await prisma.generation.findMany({
        where: { userId, ...(status ? { status: status as "PROCESSING" | "COMPLETED" | "FAILED" } : {}) },
        orderBy: { queuedAt: "desc" },
        take: limit,
        select: {
          id: true,
          workflowType: true,
          status: true,
          modelId: true,
          creditsCost: true,
          outputUrl: true,
          thumbnailUrl: true,
          queuedAt: true,
          completedAt: true,
          errorMessage: true,
        },
      });
      const list = await Promise.all(
        rows.map(async (r) => ({
          id: r.id,
          status: r.status,
          modelId: r.modelId,
          workflowType: r.workflowType,
          credits: r.creditsCost,
          outputUrl: r.outputUrl ? await signIfR2(r.outputUrl) : null,
          thumbnailUrl: r.thumbnailUrl ? await signIfR2(r.thumbnailUrl) : null,
          queuedAt: r.queuedAt?.toISOString() ?? null,
          completedAt: r.completedAt?.toISOString() ?? null,
          errorMessage: r.errorMessage ? sanitizeClientError(r.errorMessage, "mcp/recent") : null,
        })),
      );
      const lines = list.map((g) => `• ${g.id} [${g.status}] ${g.modelId} (${g.credits} cr)${g.outputUrl ? ` → ${g.outputUrl}` : ""}`);
      return textResult(lines.join("\n") || "No generations found.", { generations: list, total: list.length });
    },
  },

  // ── 4. Get one generation ──────────────────────────────────────────────────
  {
    name: "get_generation",
    title: "Get generation by ID",
    description:
      "Return the full state of one specific Artifacial generation. Use this to poll the status of a generation submitted by another MCP tool (image background removal, upscaling, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        generationId: { type: "string", description: "The generation ID returned when the job was submitted." },
      },
      required: ["generationId"],
      additionalProperties: false,
    },
    handler: async (userId, args) => {
      const id = asString(args.generationId);
      if (!id) return errorResult("generationId is required");
      const r = await prisma.generation.findFirst({
        where: { id, userId },
        select: {
          id: true,
          workflowType: true,
          status: true,
          modelId: true,
          creditsCost: true,
          outputUrl: true,
          thumbnailUrl: true,
          progress: true,
          queuedAt: true,
          startedAt: true,
          completedAt: true,
          errorMessage: true,
          inputParams: true,
        },
      });
      if (!r) return errorResult(`Generation ${id} not found`);
      const structured = {
        id: r.id,
        status: r.status,
        progress: r.progress,
        modelId: r.modelId,
        workflowType: r.workflowType,
        credits: r.creditsCost,
        outputUrl: r.outputUrl ? await signIfR2(r.outputUrl) : null,
        thumbnailUrl: r.thumbnailUrl ? await signIfR2(r.thumbnailUrl) : null,
        queuedAt: r.queuedAt?.toISOString() ?? null,
        startedAt: r.startedAt?.toISOString() ?? null,
        completedAt: r.completedAt?.toISOString() ?? null,
        errorMessage: r.errorMessage ? sanitizeClientError(r.errorMessage, "mcp/get") : null,
      };
      return textResult(`${r.id} [${r.status}] ${r.modelId} — ${structured.outputUrl ?? r.errorMessage ?? "in progress"}`, structured);
    },
  },

  // ── 5. Virality predictor (synchronous) ────────────────────────────────────
  {
    name: "analyze_video_virality",
    title: "Predict video virality",
    description:
      "Score a short-form video (TikTok / Reels / Shorts) for viral potential using Claude Sonnet 4.6. Returns hook/retention/scroll-stop scores plus honest critique and concrete recommendations. The video URL must be a publicly accessible MP4 (5-30 s recommended). Cost: 200 credits. SYNCHRONOUS — result is returned immediately.",
    inputSchema: {
      type: "object",
      properties: {
        videoUrl: { type: "string", format: "uri", description: "Public URL of the video to analyze." },
      },
      required: ["videoUrl"],
      additionalProperties: false,
    },
    handler: async (userId, args) => {
      const videoUrl = asString(args.videoUrl);
      if (!videoUrl) return errorResult("videoUrl is required");

      const credits = 200;
      const ok = await deductCredits(userId, credits, "MCP: analyze_video_virality");
      if (!ok) return errorResult("Insufficient credits — need 200 cr.");

      try {
        const buf = await safeFetchUserUrl(videoUrl, { maxBytes: 100 * 1024 * 1024 });
        const score = await analyzeVirality(buf);

        // Persist to /gallery for parity with workshop submissions
        await createMCPGeneration({
          userId,
          toolName: "Virality Predictor",
          workflowType: "IMAGE_EDIT",
          modelId: "virality-predictor",
          credits,
          inputParams: { toolSlug: "virality-predictor", videoUrl, viralityScore: score },
        }).then((id) =>
          prisma.generation.update({ where: { id }, data: { status: "COMPLETED", completedAt: new Date(), progress: 100 } }),
        );

        const summary = `Overall ${score.overallScore} · Hook ${score.hookScore} · Retention ${score.retentionScore} · Scroll-stop ${score.scrollStopScore}\n\n${score.verdict}\n\nHook: ${score.hookCritique}\n\nContent: ${score.contentCritique}\n\nRecommendations:\n${score.recommendations.map((r) => `• ${r}`).join("\n")}`;
        return textResult(summary, score as unknown as Record<string, unknown>);
      } catch (err) {
        await refundCredits(userId, credits, "MCP: virality analysis failed");
        return errorResult(sanitizeClientError(err instanceof Error ? err.message : String(err), "mcp/virality"));
      }
    },
  },

  // ── 6. Remove image background (async) ─────────────────────────────────────
  {
    name: "remove_image_background",
    title: "Remove image background",
    description:
      "Submit an image for background removal via PiAPI image-toolkit. Returns a generationId immediately — poll with get_generation to retrieve the result URL. Cost: 10 credits.",
    inputSchema: {
      type: "object",
      properties: {
        imageUrl: { type: "string", format: "uri", description: "Public URL of the image to process." },
      },
      required: ["imageUrl"],
      additionalProperties: false,
    },
    handler: async (userId, args) => {
      const imageUrl = asString(args.imageUrl);
      if (!imageUrl) return errorResult("imageUrl is required");

      const credits = 10;
      const ok = await deductCredits(userId, credits, "MCP: remove_image_background");
      if (!ok) return errorResult("Insufficient credits — need 10 cr.");

      try {
        const result = await submitTask("Qubico/image-toolkit", "background-remove", { image: imageUrl });
        const generationId = await createMCPGeneration({
          userId,
          toolName: "Remove Background",
          workflowType: "IMAGE_EDIT",
          modelId: "remove-bg",
          credits,
          inputParams: { toolSlug: "remove-bg", piApiTaskId: result.taskId, imageUrl, outputType: "image" },
        });
        return textResult(
          `Submitted. Poll with get_generation(generationId: "${generationId}").`,
          { generationId, status: "processing", credits },
        );
      } catch (err) {
        await refundCredits(userId, credits, "MCP: bg-remove submission failed");
        return errorResult(sanitizeClientError(err instanceof Error ? err.message : String(err), "mcp/remove-bg"));
      }
    },
  },

  // ── 7. Image upscale — Recraft (async, budget) ─────────────────────────────
  {
    name: "upscale_image_recraft",
    title: "Upscale image (Recraft Crisp)",
    description:
      "Upscale an image via Recraft Crisp Upscale (budget tier). Returns a generationId immediately — poll with get_generation. Cost: 60 credits.",
    inputSchema: {
      type: "object",
      properties: {
        imageUrl: { type: "string", format: "uri" },
      },
      required: ["imageUrl"],
      additionalProperties: false,
    },
    handler: async (userId, args) => {
      const imageUrl = asString(args.imageUrl);
      if (!imageUrl) return errorResult("imageUrl is required");

      const credits = 60;
      const ok = await deductCredits(userId, credits, "MCP: upscale_image_recraft");
      if (!ok) return errorResult("Insufficient credits — need 60 cr.");

      const callbackUrl = `${process.env.APP_URL ?? "https://artifacial.app"}/api/webhooks/kieai`;
      try {
        const result = await submitRecraftCrispUpscale({ imageUrl, callbackUrl });
        const generationId = await createMCPGeneration({
          userId,
          toolName: "Recraft Crisp Upscale",
          workflowType: "UPSCALE",
          modelId: "recraft-crisp-upscale",
          credits,
          inputParams: { toolSlug: "recraft-crisp-upscale", kieAiTaskId: `kieai:image:${result.taskId}`, imageUrl, outputType: "image" },
        });
        return textResult(
          `Submitted. Poll with get_generation(generationId: "${generationId}").`,
          { generationId, status: "processing", credits },
        );
      } catch (err) {
        await refundCredits(userId, credits, "MCP: recraft submission failed");
        return errorResult(sanitizeClientError(err instanceof Error ? err.message : String(err), "mcp/recraft"));
      }
    },
  },

  // ── 8. Image upscale — Topaz (async, premium) ──────────────────────────────
  {
    name: "upscale_image_topaz",
    title: "Upscale image (Topaz premium)",
    description:
      "Upscale an image via Topaz Photo AI (premium tier). Higher quality than the Recraft tier — restored detail and crisp edges at 2x / 4x / 8x. Returns a generationId immediately — poll with get_generation. Cost: 800 / 1,600 / 3,200 credits.",
    inputSchema: {
      type: "object",
      properties: {
        imageUrl: { type: "string", format: "uri" },
        upscaleFactor: { type: "integer", enum: [2, 4, 8], default: 2 },
      },
      required: ["imageUrl"],
      additionalProperties: false,
    },
    handler: async (userId, args) => {
      const imageUrl = asString(args.imageUrl);
      if (!imageUrl) return errorResult("imageUrl is required");
      const factorRaw = Number(args.upscaleFactor ?? 2);
      const upscaleFactor = (factorRaw === 4 || factorRaw === 8 ? factorRaw : 2) as 2 | 4 | 8;

      const credits = upscaleFactor === 8 ? 3200 : upscaleFactor === 4 ? 1600 : 800;
      const ok = await deductCredits(userId, credits, `MCP: upscale_image_topaz x${upscaleFactor}`);
      if (!ok) return errorResult(`Insufficient credits — need ${credits} cr.`);

      const callbackUrl = `${process.env.APP_URL ?? "https://artifacial.app"}/api/webhooks/kieai`;
      try {
        const result = await submitTopazImageUpscale({ imageUrl, upscaleFactor, callbackUrl });
        const generationId = await createMCPGeneration({
          userId,
          toolName: "Topaz Image Upscale",
          workflowType: "UPSCALE",
          modelId: "topaz-image-upscale",
          credits,
          inputParams: { toolSlug: "topaz-image-upscale", kieAiTaskId: `kieai:image:${result.taskId}`, imageUrl, upscaleFactor, outputType: "image" },
        });
        return textResult(
          `Submitted at ${upscaleFactor}x. Poll with get_generation(generationId: "${generationId}").`,
          { generationId, status: "processing", upscaleFactor, credits },
        );
      } catch (err) {
        await refundCredits(userId, credits, "MCP: topaz submission failed");
        return errorResult(sanitizeClientError(err instanceof Error ? err.message : String(err), "mcp/topaz"));
      }
    },
  },
];

// ─── Registry helpers ────────────────────────────────────────────────────────

/** R2 keys come back as `users/...` strings — sign them. Pass-through for full URLs. */
async function signIfR2(url: string): Promise<string> {
  if (url.startsWith("http")) return url;
  try {
    return await getSignedR2Url(url, 3600);
  } catch {
    return url;
  }
}

/** Public catalog returned by `tools/list`. */
export function listMCPTools() {
  return TOOLS.map((t) => ({
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: t.inputSchema,
  }));
}

/** Dispatch a `tools/call` invocation by name. Returns null if no such tool. */
export async function callMCPTool(
  name: string,
  userId: string,
  args: Record<string, unknown>,
): Promise<MCPToolResult | null> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return null;
  try {
    return await tool.handler(userId, args ?? {});
  } catch (err) {
    return errorResult(sanitizeClientError(err instanceof Error ? err.message : String(err), `mcp/${name}`));
  }
}
