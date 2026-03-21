import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { routeGeneration } from "@/lib/generation/router";
import { isValidModelId, getModelById } from "@/lib/models/registry";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    prompt?: string;
    modelId?: string;
    imageUrl?: string;
    endImageUrl?: string;
    videoUrl?: string;
    characterId?: string;
    projectId?: string;
    sceneId?: string;
    durationSec?: number;
    resolution?: string;
    aspectRatio?: string;
    withAudio?: boolean;
    characterOrientation?: "image" | "video";
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate required fields
  if (!body.prompt || typeof body.prompt !== "string" || body.prompt.trim().length === 0) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  if (body.prompt.length > 2000) {
    return NextResponse.json({ error: "Prompt must be under 2000 characters" }, { status: 400 });
  }

  // Validate model against registry
  if (body.modelId && !isValidModelId(body.modelId)) {
    return NextResponse.json(
      { error: `Invalid model: ${body.modelId}` },
      { status: 400 }
    );
  }

  // Validate duration against model's max
  const durationSec = body.durationSec ?? 5;
  const model = body.modelId ? getModelById(body.modelId) : null;
  const maxDuration = model?.maxDuration ?? 30;

  if (durationSec < 1 || durationSec > maxDuration) {
    return NextResponse.json(
      { error: `Duration must be between 1 and ${maxDuration} seconds for this model` },
      { status: 400 }
    );
  }

  // Validate resolution
  const resolution = body.resolution ?? "720p";
  if (!["720p", "1080p", "1440p", "4K"].includes(resolution)) {
    return NextResponse.json({ error: "Resolution must be 720p, 1080p, 1440p, or 4K" }, { status: 400 });
  }

  // Validate character orientation for motion control
  if (body.characterOrientation && !["image", "video"].includes(body.characterOrientation)) {
    return NextResponse.json({ error: "characterOrientation must be 'image' or 'video'" }, { status: 400 });
  }

  // Extract IP address for NSFW audit logging
  const ipAddress =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;

  // Route the generation
  const result = await routeGeneration({
    userId: session.user.id,
    prompt: body.prompt.trim(),
    modelId: body.modelId,
    imageUrl: body.imageUrl,
    endImageUrl: body.endImageUrl,
    videoUrl: body.videoUrl,
    characterId: body.characterId,
    projectId: body.projectId,
    sceneId: body.sceneId,
    durationSec,
    resolution,
    aspectRatio: body.aspectRatio,
    withAudio: body.withAudio,
    characterOrientation: body.characterOrientation,
    ipAddress,
  });

  if (!result.success) {
    const statusCode =
      result.errorCode === "MODERATION_BLOCK" ? 403 :
      result.errorCode === "INSUFFICIENT_CREDITS" ? 402 :
      result.errorCode === "RESOLUTION_DENIED" ? 403 :
      result.errorCode === "NSFW_NOT_READY" ? 501 :
      result.errorCode === "NSFW_PAYWALL" ? 403 :
      result.errorCode === "NSFW_PROMPT_ON_SFW_MODEL" ? 400 :
      result.errorCode === "INVALID_MODEL" ? 400 :
      500;

    return NextResponse.json(
      { error: result.error, errorCode: result.errorCode, generationId: result.generationId },
      { status: statusCode }
    );
  }

  return NextResponse.json({
    generationId: result.generationId,
    message: "Generation submitted successfully",
  });
}

/**
 * GET /api/generate — list user's recent generations
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const generations = await prisma.generation.findMany({
    where: { userId: session.user.id },
    orderBy: { queuedAt: "desc" },
    take: 50,
    select: {
      id: true,
      workflowType: true,
      status: true,
      provider: true,
      modelId: true,
      contentMode: true,
      resolution: true,
      durationSec: true,
      creditsCost: true,
      outputUrl: true,
      thumbnailUrl: true,
      errorMessage: true,
      progress: true,
      queuedAt: true,
      startedAt: true,
      completedAt: true,
    },
  });

  return NextResponse.json({ generations });
}
