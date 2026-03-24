import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deductCredits } from "@/lib/credits";
import { uploadToR2, getSignedR2Url } from "@/lib/r2";
import {
  isPostProcessType,
  POST_PROCESS_WORKFLOW_MAP,
  POST_PROCESS_CREDITS,
  type PostProcessParams,
} from "@/lib/generation/postprocess-types";
import {
  submitImageFaceSwap,
  submitVideoFaceSwap,
  submitBackgroundRemoval,
  submitVirtualTryOn,
  submitAIHug,
} from "@/lib/piapi-client";

function r2Key(userId: string, generationId: string, filename: string) {
  return `users/${userId}/generations/${generationId}/${filename}`;
}

/**
 * Resolve a media reference to a publicly-accessible URL.
 * If the value is already an HTTP URL, return it directly.
 * If it's an R2 key, generate a signed URL (1-hour expiry is enough for PiAPI to fetch it).
 */
async function resolveToUrl(value: string): Promise<string> {
  if (value.startsWith("http")) return value;
  return getSignedR2Url(value, 3600);
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
      workflowType: true,
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
      { error: "Source generation has no output" },
      { status: 400 }
    );
  }

  // 2. Parse and validate request body
  const body = await req.json();
  const {
    type,
    faceImage,
    characterId,
    bgModel,
    dressImageUrl,
    upperImageUrl,
    lowerImageUrl,
  } = body as {
    type?: string;
    faceImage?: string;        // base64 data URL (new upload) for face swap
    characterId?: string;      // existing character ID (reuse face)
    bgModel?: "RMBG-1.4" | "RMBG-2.0" | "BEN2";
    dressImageUrl?: string;    // virtual try-on — full dress
    upperImageUrl?: string;    // virtual try-on — upper garment
    lowerImageUrl?: string;    // virtual try-on — lower garment
  };

  if (!type || !isPostProcessType(type)) {
    return NextResponse.json(
      { error: `Invalid post-process type. Must be one of: FACE_SWAP, VIDEO_FACE_SWAP, UPSCALE, BACKGROUND_REMOVAL, VIRTUAL_TRY_ON, AI_HUG` },
      { status: 400 }
    );
  }

  // 3. Type-specific validation
  const isVideoSource =
    parent.workflowType === "TEXT_TO_VIDEO" ||
    parent.workflowType === "IMAGE_TO_VIDEO" ||
    parent.workflowType === "MOTION_TRANSFER";

  // Face swap: need either characterId or faceImage
  let resolvedFaceR2Key: string | undefined;
  if (type === "FACE_SWAP" || type === "VIDEO_FACE_SWAP") {
    if (characterId) {
      const character = await prisma.character.findFirst({
        where: { id: characterId, userId: session.user.id },
        select: { faceImageUrl: true },
      });
      if (!character?.faceImageUrl) {
        return NextResponse.json(
          { error: "Character has no face image." },
          { status: 400 }
        );
      }
      resolvedFaceR2Key = character.faceImageUrl;
    } else if (faceImage) {
      // Will upload after generation record is created
    } else {
      return NextResponse.json(
        { error: "Face image or character required for face swap" },
        { status: 400 }
      );
    }

    // VIDEO_FACE_SWAP requires a video source
    if (type === "VIDEO_FACE_SWAP" && !isVideoSource) {
      return NextResponse.json(
        { error: "Video face swap requires a video source generation" },
        { status: 400 }
      );
    }
  }

  if (type === "BACKGROUND_REMOVAL" && isVideoSource) {
    return NextResponse.json(
      { error: "Background removal only works on images" },
      { status: 400 }
    );
  }

  if (type === "VIRTUAL_TRY_ON") {
    if (!dressImageUrl && !upperImageUrl && !lowerImageUrl) {
      return NextResponse.json(
        { error: "At least one garment image is required for virtual try-on" },
        { status: 400 }
      );
    }
    if (isVideoSource) {
      return NextResponse.json(
        { error: "Virtual try-on only works on images" },
        { status: 400 }
      );
    }
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
    // 5. Upload face image to R2 if needed (before generation record so we have the key)
    let faceImageR2Key = resolvedFaceR2Key;
    if ((type === "FACE_SWAP" || type === "VIDEO_FACE_SWAP") && faceImage && !faceImageR2Key) {
      const base64Data = faceImage.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const tempKey = r2Key(session.user.id, parentId, `face-input-${Date.now()}.png`);
      await uploadToR2(tempKey, buffer, "image/png");
      faceImageR2Key = tempKey;
    }

    // 6. Submit to PiAPI
    const sourceMediaUrl = await resolveToUrl(parent.outputUrl);
    let faceImageUrl: string | undefined;
    if (faceImageR2Key) {
      faceImageUrl = await resolveToUrl(faceImageR2Key);
    }

    let piApiTaskId: string;
    const postProcessParams: PostProcessParams = {};

    switch (type) {
      case "FACE_SWAP": {
        const result = await submitImageFaceSwap(sourceMediaUrl, faceImageUrl!);
        piApiTaskId = result.taskId;
        postProcessParams.faceImageR2Key = faceImageR2Key;
        break;
      }
      case "VIDEO_FACE_SWAP": {
        const result = await submitVideoFaceSwap(sourceMediaUrl, faceImageUrl!);
        piApiTaskId = result.taskId;
        postProcessParams.faceImageR2Key = faceImageR2Key;
        break;
      }
      case "BACKGROUND_REMOVAL": {
        const result = await submitBackgroundRemoval(sourceMediaUrl, bgModel || "RMBG-2.0");
        piApiTaskId = result.taskId;
        postProcessParams.bgModel = bgModel || "RMBG-2.0";
        break;
      }
      case "VIRTUAL_TRY_ON": {
        const result = await submitVirtualTryOn(sourceMediaUrl, {
          dressUrl: dressImageUrl,
          upperUrl: upperImageUrl,
          lowerUrl: lowerImageUrl,
        });
        piApiTaskId = result.taskId;
        postProcessParams.dressImageUrl = dressImageUrl;
        postProcessParams.upperImageUrl = upperImageUrl;
        postProcessParams.lowerImageUrl = lowerImageUrl;
        break;
      }
      case "AI_HUG": {
        const result = await submitAIHug(sourceMediaUrl);
        piApiTaskId = result.taskId;
        postProcessParams.sourceImageUrl = sourceMediaUrl;
        break;
      }
      case "UPSCALE": {
        // Upscale not yet available on PiAPI — placeholder
        return NextResponse.json(
          { error: "Upscale is not yet available. Coming soon." },
          { status: 501 }
        );
      }
      default:
        return NextResponse.json({ error: "Unknown post-process type" }, { status: 400 });
    }

    // 7. Create Generation record linked to parent with PiAPI task ID
    const generation = await prisma.generation.create({
      data: {
        userId: session.user.id,
        parentGenerationId: parentId,
        workflowType,
        status: "PROCESSING",
        contentMode: parent.contentMode,
        provider: "PIAPI",
        modelId: `piapi-${type.toLowerCase().replace(/_/g, "-")}`,
        creditsCost,
        resolution: parent.resolution,
        inputParams: {
          type,
          parentGenerationId: parentId,
          piApiTaskId,
          sourceMediaUrl: parent.outputUrl,
          ...postProcessParams,
        },
      },
    });

    return NextResponse.json({
      success: true,
      generationId: generation.id,
      parentGenerationId: parentId,
      type,
      creditsCost,
      piApiTaskId,
    });
  } catch (error) {
    // Refund on failure
    const { refundCredits } = await import("@/lib/credits");
    await refundCredits(session.user.id, creditsCost, `Refund: ${type} post-processing failed`);

    console.error("Post-process submission error:", error);
    return NextResponse.json(
      { error: "Failed to submit post-processing. Credits have been refunded." },
      { status: 500 }
    );
  }
}
