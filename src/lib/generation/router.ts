import { prisma } from "@/lib/db";
import { resolveContentMode } from "@/lib/moderation";
import { classifyPrompt } from "@/lib/moderation";
import { deductCredits, refundCredits } from "@/lib/credits";
import { canUseResolution } from "@/lib/stripe";
import { getRedis, NSFW_QUEUE } from "@/lib/redis";
import {
  submitGeneration as falSubmit,
  submitMotionControl as falSubmitMotion,
  estimateApiCost,
} from "./fal-client";
import {
  getModelById,
  isValidModelId,
  calculateCreditCost,
  getDefaultModelId,
  getModelEndpoint,
  type ModelMode,
} from "@/lib/models/registry";
import type {
  ContentMode,
  WorkflowType,
} from "@/generated/prisma/client";

// ─── Types ───

export type GenerationProvider = "FAL_AI" | "SELF_HOSTED" | "COMFYUI_POST_PROCESS";

export type GenerationRequest = {
  userId: string;
  prompt: string;
  modelId?: string;
  imageUrl?: string;
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

// ─── Main Router ───

export async function routeGeneration(
  request: GenerationRequest
): Promise<GenerationRouterResult> {
  const {
    userId,
    prompt,
    modelId: requestedModel,
    imageUrl: rawImageUrl,
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
    if (imageUrl?.startsWith("r2:")) {
      const { getSignedR2Url } = await import("@/lib/r2");
      imageUrl = await getSignedR2Url(imageUrl.slice(3), 3600);
    }
    // 1. Resolve content mode (checks user prefs, age, character eligibility)
    const { effectiveMode } = await resolveContentMode(userId, characterId);

    // 1b. Redundant NSFW paywall check — never trust the frontend alone
    if (effectiveMode === "NSFW") {
      const tierCheck = await prisma.user.findUnique({
        where: { id: userId },
        select: { subscriptionTier: true },
      });
      if (tierCheck?.subscriptionTier === "FREE") {
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

    // 4b. NSFW prompt laundering check — block NSFW prompts on SFW fal.ai models
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
    const apiCost = model.provider === "FAL" ? estimateApiCost(modelId, durationSec) : null;

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
        provider: model.provider === "SELF_HOSTED" ? "SELF_HOSTED" : "FAL_AI",
        modelId,
        apiCost,
        withAudio: audioEnabled,
        creditsCost,
        resolution,
        durationSec,
        inputParams: {
          prompt,
          imageUrl: imageUrl || null,
          videoUrl: videoUrl || null,
          aspectRatio,
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

    // ─── NSFW path: push to Redis queue for Python worker ───
    if (model.provider === "SELF_HOSTED") {
      try {
        const redis = getRedis();
        await redis.lpush(
          NSFW_QUEUE,
          JSON.stringify({
            generationId: generation.id,
            userId,
            prompt,
            negativePrompt: "",
            imagePath: imageUrl || null,
            durationSec,
            resolution,
            modelId,
            contentMode: effectiveMode,
            creditsCost,
            withAudio: audioEnabled,
          })
        );

        return { success: true, generationId: generation.id };
      } catch (redisError) {
        await refundCredits(userId, creditsCost, `Refund: ${workflowType} queue submission failed`);
        await prisma.generation.update({
          where: { id: generation.id },
          data: {
            status: "FAILED",
            errorMessage: redisError instanceof Error ? redisError.message : "Failed to queue generation",
            completedAt: new Date(),
          },
        });

        return {
          success: false,
          generationId: generation.id,
          error: "Generation failed to queue. Credits have been refunded.",
          errorCode: "SYSTEM_ERROR",
        };
      }
    }

    // ─── FAL path: submit to fal.ai ───
    try {
      let falResult;

      if (mode === "MOTION_TRANSFER") {
        if (!imageUrl || !videoUrl) {
          await refundCredits(userId, creditsCost, `Refund: motion control missing inputs`);
          return {
            success: false,
            generationId: generation.id,
            error: "Motion transfer requires both an image and a reference video.",
            errorCode: "SYSTEM_ERROR",
          };
        }
        falResult = await falSubmitMotion(modelId, {
          prompt,
          imageUrl,
          videoUrl,
          characterOrientation,
          durationSec,
          aspectRatio,
        });
      } else {
        falResult = await falSubmit(modelId, {
          prompt,
          imageUrl,
          durationSec,
          aspectRatio,
          withAudio: audioEnabled,
        });
      }

      await prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: "PROCESSING",
          startedAt: new Date(),
          promptId: falResult.requestId,
          inputParams: {
            prompt,
            imageUrl: imageUrl || null,
            videoUrl: videoUrl || null,
            aspectRatio,
            modelId,
            withAudio: audioEnabled,
            falRequestId: falResult.requestId,
            falEndpoint: falResult.endpoint,
          },
        },
      });

      return { success: true, generationId: generation.id };
    } catch (falError) {
      await refundCredits(userId, creditsCost, `Refund: ${workflowType} submission failed`);
      await prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: "FAILED",
          errorMessage: falError instanceof Error ? falError.message : "fal.ai submission failed",
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
    console.error("Generation router error:", error);
    return {
      success: false,
      error: "An unexpected error occurred",
      errorCode: "SYSTEM_ERROR",
    };
  }
}
