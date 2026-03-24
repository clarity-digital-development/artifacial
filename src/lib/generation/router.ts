import { prisma } from "@/lib/db";
import { resolveContentMode } from "@/lib/moderation";
import { classifyPrompt } from "@/lib/moderation";
import { deductCredits, refundCredits } from "@/lib/credits";
import { canUseResolution } from "@/lib/stripe";
import {
  submitTask,
  buildVideoInput,
  buildImageInput,
  estimateApiCost,
} from "@/lib/piapi-client";
import {
  getModelById,
  isValidModelId,
  calculateCreditCost,
  getDefaultModelId,
  getPiApiTaskType,
  type ModelMode,
} from "@/lib/models/registry";
import type {
  ContentMode,
  WorkflowType,
} from "@/generated/prisma/client";

// ─── Types ───

export type GenerationProvider = "PIAPI";

export type GenerationRequest = {
  userId: string;
  prompt: string;
  modelId?: string;
  imageUrl?: string;
  endImageUrl?: string;
  videoUrl?: string;
  characterId?: string | null;
  projectId?: string | null;
  sceneId?: string | null;
  durationSec?: number;
  resolution?: string;
  aspectRatio?: string;
  withAudio?: boolean;
  characterOrientation?: "image" | "video";
  ipAddress?: string | null;
};

export type GenerationRouterResult = {
  success: boolean;
  generationId?: string;
  error?: string;
  errorCode?:
    | "MODERATION_BLOCK"
    | "INSUFFICIENT_CREDITS"
    | "RESOLUTION_DENIED"
    | "NSFW_NOT_READY"
    | "NSFW_PAYWALL"
    | "NSFW_PROMPT_ON_SFW_MODEL"
    | "INVALID_MODEL"
    | "SYSTEM_ERROR";
};

// ─── Workflow type mapping ───

function resolveWorkflowType(mode: ModelMode): WorkflowType {
  switch (mode) {
    case "T2V": return "TEXT_TO_VIDEO";
    case "I2V": return "IMAGE_TO_VIDEO";
    case "T2I": return "TEXT_TO_IMAGE";
    case "MOTION_TRANSFER": return "MOTION_TRANSFER";
  }
}

// ─── Resolve generation mode from model + params ───

function resolveGenerationMode(modelId: string, hasImage: boolean): ModelMode {
  const model = getModelById(modelId);
  if (!model) return hasImage ? "I2V" : "T2V";
  if (model.supportedModes.includes("T2I")) return "T2I";
  if (model.supportedModes.includes("MOTION_TRANSFER")) return "MOTION_TRANSFER";
  if (hasImage && model.supportedModes.includes("I2V")) return "I2V";
  return "T2V";
}

// ─── Aspect ratio → pixel dimensions (for image models) ───

const ASPECT_RATIO_DIMS: Record<string, { width: number; height: number }> = {
  "1:1": { width: 1024, height: 1024 },
  "3:4": { width: 768, height: 1024 },
  "4:3": { width: 1024, height: 768 },
  "2:3": { width: 682, height: 1024 },
  "3:2": { width: 1024, height: 682 },
  "9:16": { width: 576, height: 1024 },
  "16:9": { width: 1024, height: 576 },
};

function aspectRatioToDimensions(ar: string): { width: number; height: number } {
  return ASPECT_RATIO_DIMS[ar] ?? ASPECT_RATIO_DIMS["1:1"];
}

// ─── Main Router ───

export async function routeGeneration(
  request: GenerationRequest
): Promise<GenerationRouterResult> {
  const {
    userId,
    prompt,
    modelId: requestedModel,
    imageUrl: rawImageUrl,
    endImageUrl: rawEndImageUrl,
    videoUrl,
    characterId,
    projectId,
    sceneId,
    durationSec = 5,
    resolution = "720p",
    aspectRatio = "16:9",
    withAudio = false,
    characterOrientation = "image",
    ipAddress,
  } = request;

  try {
    // Resolve R2 key references to signed URLs (from character picker)
    let imageUrl = rawImageUrl;
    let endImageUrl = rawEndImageUrl;
    if (imageUrl?.startsWith("r2:")) {
      const { getSignedR2Url } = await import("@/lib/r2");
      imageUrl = await getSignedR2Url(imageUrl.slice(3), 3600);
    }
    if (endImageUrl?.startsWith("r2:")) {
      const { getSignedR2Url } = await import("@/lib/r2");
      endImageUrl = await getSignedR2Url(endImageUrl.slice(3), 3600);
    }

    // 1. Resolve content mode (checks user prefs, age, character eligibility)
    const { effectiveMode } = await resolveContentMode(userId, characterId);

    // 1b. Redundant NSFW paywall check — never trust the frontend alone
    if (effectiveMode === "NSFW") {
      const tierCheck = await prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionTier: true, isAdmin: true },
      });
      if (tierCheck?.subscriptionTier === "FREE" && !tierCheck?.isAdmin) {
        return {
          success: false,
          error: "NSFW generation requires a Starter plan or above.",
          errorCode: "NSFW_PAYWALL",
        };
      }
    }

    // 2. Resolve model from registry
    const mode = resolveGenerationMode(
      requestedModel || "",
      !!imageUrl
    );
    const defaultModel = getDefaultModelId(mode, effectiveMode);
    const modelId = requestedModel || defaultModel;

    // 2b. Validate model exists in registry
    if (!isValidModelId(modelId)) {
      return {
        success: false,
        error: `Unknown model: ${modelId}`,
        errorCode: "INVALID_MODEL",
      };
    }

    const model = getModelById(modelId)!;

    // 2c. Validate model content mode against user content mode
    if (model.contentMode === "NSFW" && effectiveMode === "SFW") {
      return {
        success: false,
        error: "This model requires NSFW mode to be enabled in settings.",
        errorCode: "NSFW_PAYWALL",
      };
    }

    // 3. Check resolution gating
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionTier: true, isAdmin: true },
    });
    const isAdmin = !!user?.isAdmin;

    if (!user) {
      return { success: false, error: "User not found", errorCode: "SYSTEM_ERROR" };
    }

    if (!canUseResolution(user.subscriptionTier, resolution)) {
      return {
        success: false,
        error: `Your ${user.subscriptionTier} plan supports up to ${resolution === "1440p" ? "1080p" : "720p"}. Upgrade to unlock higher resolutions.`,
        errorCode: "RESOLUTION_DENIED",
      };
    }

    // 4. Run prompt classifier (admins bypass classifier failures)
    const classification = await classifyPrompt(prompt, effectiveMode);
    if (!classification.allowed) {
      const isSystemError = classification.reason?.startsWith("SYSTEM_ERROR");
      if (isSystemError && isAdmin) {
        console.warn(`[router] Admin bypass: classifier failed but allowing admin user=${userId}`);
      } else {
        return {
          success: false,
          error: classification.reason || "Content blocked by moderation",
          errorCode: "MODERATION_BLOCK",
        };
      }
    }

    // 4b. NSFW prompt laundering check — block NSFW prompts on SFW models
    if (model.contentMode === "SFW" && classification.sexualContent) {
      return {
        success: false,
        error: "This prompt contains mature content. Please select an NSFW model or modify your prompt.",
        errorCode: "NSFW_PROMPT_ON_SFW_MODEL",
      };
    }

    // 5. Calculate credit cost and deduct
    const workflowType = resolveWorkflowType(mode);
    const creditsCost = calculateCreditCost(modelId, durationSec);
    const audioEnabled = withAudio && model.supportsAudio;

    const deducted = await deductCredits(
      userId,
      creditsCost,
      `${workflowType} generation (${model.name}, ${durationSec}s, ${resolution}${audioEnabled ? ", audio" : ""})`
    );

    if (!deducted) {
      return {
        success: false,
        error: `Not enough credits. This generation costs ${creditsCost} credit${creditsCost > 1 ? "s" : ""}.`,
        errorCode: "INSUFFICIENT_CREDITS",
      };
    }

    // 6. Estimate API cost for margin tracking
    const costKey = model.pipiConfig.costKey;
    const apiCost = estimateApiCost(costKey, { durationSec });

    // 7. Create Generation record
    const generation = await prisma.generation.create({
      data: {
        userId,
        characterId: characterId || undefined,
        projectId: projectId || undefined,
        sceneId: sceneId || undefined,
        workflowType,
        status: "QUEUED",
        contentMode: effectiveMode,
        provider: "PIAPI",
        modelId,
        apiCost,
        withAudio: audioEnabled,
        creditsCost,
        resolution,
        durationSec,
        inputParams: {
          prompt,
          imageUrl: imageUrl || null,
          endImageUrl: endImageUrl || null,
          videoUrl: videoUrl || null,
          aspectRatio,
          resolution,
          modelId,
          withAudio: audioEnabled,
          characterOrientation: mode === "MOTION_TRANSFER" ? characterOrientation : undefined,
        },
      },
    });

    // 8. Store moderation result (with audit fields for NSFW)
    await prisma.generationModeration.create({
      data: {
        generationId: generation.id,
        promptClassification: JSON.parse(JSON.stringify(classification)),
        flagged: false,
        promptText: effectiveMode === "NSFW" ? prompt : null,
        ipAddress: effectiveMode === "NSFW" ? (ipAddress ?? null) : null,
      },
    });

    // 9. Submit to PiAPI
    try {
      const piApiModel = model.pipiConfig.model;
      const taskType = getPiApiTaskType(modelId, mode);

      if (!taskType) {
        throw new Error(`No PiAPI task type for model ${modelId} mode ${mode}`);
      }

      // Build the input payload based on model type
      const isT2I = mode === "T2I";
      const input = isT2I
        ? buildImageInput(piApiModel, taskType, {
            prompt,
            ...aspectRatioToDimensions(aspectRatio),
          })
        : buildVideoInput(piApiModel, taskType, {
            prompt,
            imageUrl: imageUrl || null,
            endImageUrl: endImageUrl || null,
            videoUrl: videoUrl || null,
            durationSec,
            aspectRatio,
            resolution,
            withAudio: audioEnabled,
          });

      // Merge model-specific defaults (e.g., Kling version/mode)
      if (model.pipiConfig.defaults) {
        Object.assign(input, model.pipiConfig.defaults);
      }

      const result = await submitTask(piApiModel, taskType, input);

      await prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: "PROCESSING",
          startedAt: new Date(),
          promptId: result.taskId,
          inputParams: {
            prompt,
            imageUrl: imageUrl || null,
            endImageUrl: endImageUrl || null,
            videoUrl: videoUrl || null,
            aspectRatio,
            resolution,
            modelId,
            withAudio: audioEnabled,
            piApiTaskId: result.taskId,
            piApiModel,
          },
        },
      });

      return { success: true, generationId: generation.id };
    } catch (submitError) {
      await refundCredits(userId, creditsCost, `Refund: ${workflowType} PiAPI submission failed`);
      await prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: "FAILED",
          errorMessage: submitError instanceof Error ? submitError.message : "PiAPI submission failed",
          completedAt: new Date(),
        },
      });

      return {
        success: false,
        generationId: generation.id,
        error: "Generation failed to submit. Credits have been refunded.",
        errorCode: "SYSTEM_ERROR",
      };
    }
  } catch (error) {
    console.error("[router] UNHANDLED ERROR:", error instanceof Error ? `${error.message}\n${error.stack}` : error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
      errorCode: "SYSTEM_ERROR",
    };
  }
}
