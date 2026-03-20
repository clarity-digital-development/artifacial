import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deductCredits } from "@/lib/credits";
import { uploadToR2 } from "@/lib/r2";
import { getRedis, POSTPROCESS_QUEUE } from "@/lib/redis";
import {
  isPostProcessType,
  POST_PROCESS_WORKFLOW_MAP,
  POST_PROCESS_CREDITS,
  type PostProcessJob,
  type PostProcessParams,
} from "@/lib/generation/postprocess-types";

function r2Key(userId: string, generationId: string, filename: string) {
  return `users/${userId}/generations/${generationId}/${filename}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: parentId } = await params;

  // 1. Validate source generation exists, is COMPLETED, and belongs to this user
  const parent = await prisma.generation.findFirst({
    where: { id: parentId, userId: session.user.id },
    select: {
      id: true,
      status: true,
      outputUrl: true,
      resolution: true,
      contentMode: true,
      userId: true,
    },
  });

  if (!parent) {
    return NextResponse.json({ error: "Generation not found" }, { status: 404 });
  }

  if (parent.status !== "COMPLETED") {
    return NextResponse.json(
      { error: "Source generation must be completed before post-processing" },
      { status: 400 }
    );
  }

  if (!parent.outputUrl) {
    return NextResponse.json(
      { error: "Source generation has no output video" },
      { status: 400 }
    );
  }

  // 2. Parse and validate request body
  const body = await req.json();
  const { type, faceImage, characterId, audioFile, targetResolution, stylePrompt } = body as {
    type?: string;
    faceImage?: string; // base64 data URL (new upload)
    characterId?: string; // existing character ID (reuse face)
    audioFile?: string; // base64 data URL
    targetResolution?: string;
    stylePrompt?: string;
  };

  if (!type || !isPostProcessType(type)) {
    return NextResponse.json(
      { error: `Invalid post-process type. Must be one of: FACE_SWAP, UPSCALE, LIP_SYNC, STYLE_TRANSFER` },
      { status: 400 }
    );
  }

  // 3. Type-specific validation
  // Face swap accepts either a character ID (reuses stored face) or a fresh upload
  let resolvedFaceImage = faceImage;
  if (type === "FACE_SWAP") {
    if (characterId) {
      // Look up the character's face image from R2
      const character = await prisma.character.findFirst({
        where: { id: characterId, userId: session.user.id },
        select: { faceImageUrl: true, name: true },
      });
      if (!character?.faceImageUrl) {
        return NextResponse.json(
          { error: "Character has no face image. Upload one or select a different character." },
          { status: 400 }
        );
      }
      // faceImageUrl is an R2 key — pass it through as-is (worker downloads from R2)
      resolvedFaceImage = `r2:${character.faceImageUrl}`;
    } else if (!faceImage) {
      return NextResponse.json({ error: "Face image or character required for face swap" }, { status: 400 });
    }
  }
  if (type === "LIP_SYNC" && !audioFile) {
    return NextResponse.json({ error: "Audio file required for lip sync" }, { status: 400 });
  }
  if (type === "STYLE_TRANSFER" && !stylePrompt?.trim()) {
    return NextResponse.json({ error: "Style prompt required for style transfer" }, { status: 400 });
  }
  if (type === "UPSCALE" && parent.resolution !== "720p") {
    return NextResponse.json({ error: "Upscale is only available for 720p generations" }, { status: 400 });
  }

  // 4. Deduct credits
  const creditsCost = POST_PROCESS_CREDITS[type];
  const workflowType = POST_PROCESS_WORKFLOW_MAP[type];

  const deducted = await deductCredits(
    session.user.id,
    creditsCost,
    `${type} post-processing`
  );

  if (!deducted) {
    return NextResponse.json(
      { error: `Not enough credits. This costs ${creditsCost} credit${creditsCost > 1 ? "s" : ""}.` },
      { status: 402 }
    );
  }

  try {
    // 5. Create new Generation record linked to parent
    const generation = await prisma.generation.create({
      data: {
        userId: session.user.id,
        parentGenerationId: parentId,
        workflowType,
        status: "QUEUED",
        contentMode: parent.contentMode,
        provider: "COMFYUI_POST_PROCESS",
        modelId: `comfyui-${type.toLowerCase().replace(/_/g, "-")}`,
        creditsCost,
        resolution: type === "UPSCALE" ? (targetResolution || "1080p") : parent.resolution,
        inputParams: {
          type,
          parentGenerationId: parentId,
          sourceVideoUrl: parent.outputUrl,
          ...(faceImage ? { hasFaceImage: true } : {}),
          ...(audioFile ? { hasAudioFile: true } : {}),
          ...(targetResolution ? { targetResolution } : {}),
          ...(stylePrompt ? { stylePrompt } : {}),
        },
      },
    });

    // 6. Upload any binary assets to R2
    const postProcessParams: PostProcessParams = {};

    if (type === "FACE_SWAP" && resolvedFaceImage) {
      if (resolvedFaceImage.startsWith("r2:")) {
        // Character face — already in R2, pass the key directly
        postProcessParams.faceImageR2Key = resolvedFaceImage.slice(3);
      } else {
        // Fresh upload — decode base64 and upload to R2
        const base64Data = resolvedFaceImage.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const key = r2Key(session.user.id, generation.id, "face-input.png");
        await uploadToR2(key, buffer, "image/png");
        postProcessParams.faceImageR2Key = key;
      }
    }

    if (type === "LIP_SYNC" && audioFile) {
      const base64Data = audioFile.replace(/^data:audio\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const key = r2Key(session.user.id, generation.id, "audio-input.mp3");
      await uploadToR2(key, buffer, "audio/mpeg");
      postProcessParams.audioFileR2Key = key;
    }

    if (type === "UPSCALE") {
      postProcessParams.targetResolution = targetResolution || "1080p";
    }

    if (type === "STYLE_TRANSFER") {
      postProcessParams.stylePrompt = stylePrompt;
    }

    // The source video R2 key — if it's already an R2 key (not a URL), use directly
    const sourceVideoR2Key = parent.outputUrl.startsWith("http")
      ? parent.outputUrl // Worker will need to download this
      : parent.outputUrl; // Already an R2 key

    // 7. Push job to Redis queue
    const job: PostProcessJob = {
      generationId: generation.id,
      parentGenerationId: parentId,
      userId: session.user.id,
      type,
      sourceVideoR2Key,
      creditsCost,
      params: postProcessParams,
    };

    const redis = getRedis();
    await redis.lpush(POSTPROCESS_QUEUE, JSON.stringify(job));

    return NextResponse.json({
      success: true,
      generationId: generation.id,
      parentGenerationId: parentId,
      type,
      creditsCost,
    });
  } catch (error) {
    // Refund on failure
    const { refundCredits } = await import("@/lib/credits");
    await refundCredits(session.user.id, creditsCost, `Refund: ${type} post-processing failed to queue`);

    console.error("Post-process queue error:", error);
    return NextResponse.json(
      { error: "Failed to queue post-processing. Credits have been refunded." },
      { status: 500 }
    );
  }
}
