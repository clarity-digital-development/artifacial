import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deductCredits, refundCredits } from "@/lib/credits";
import { getSignedR2Url } from "@/lib/r2";
import { submitNanoBananaEdit, type KieAiNanaBananaEditParams } from "@/lib/kieai";

const CREDIT_COST = 150;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    imageR2Key?: string;
    prompt?: string;
    imageSize?: string;
    characterId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.imageR2Key || typeof body.imageR2Key !== "string") {
    return NextResponse.json({ error: "imageR2Key is required" }, { status: 400 });
  }

  if (!body.prompt || typeof body.prompt !== "string" || !body.prompt.trim()) {
    return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
  }

  if (body.prompt.length > 2000) {
    return NextResponse.json({ error: "Prompt must be under 2000 characters" }, { status: 400 });
  }

  const prompt = body.prompt.trim();
  const imageSize = (body.imageSize ?? "auto") as KieAiNanaBananaEditParams["imageSize"];

  // Deduct credits upfront
  const ok = await deductCredits(
    session.user.id,
    CREDIT_COST,
    "Image edit (Nano Banana Edit)",
    "debit"
  );
  if (!ok) {
    return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
  }

  // Sign the R2 key — KIE.AI needs a public URL
  let signedImageUrl: string;
  try {
    signedImageUrl = await getSignedR2Url(body.imageR2Key, 7200);
  } catch {
    await refundCredits(session.user.id, CREDIT_COST, "Refund: Failed to sign image URL");
    return NextResponse.json({ error: "Failed to sign image URL" }, { status: 500 });
  }

  // Create Generation record
  const generation = await prisma.generation.create({
    data: {
      userId: session.user.id,
      characterId: body.characterId ?? null,
      workflowType: "IMAGE_EDIT",
      status: "QUEUED",
      provider: "PIAPI", // KIE.AI uses the PIAPI provider slot
      modelId: "google/nano-banana-edit",
      creditsCost: CREDIT_COST,
      durationSec: 1,
      inputParams: {
        imageR2Key: body.imageR2Key,
        prompt,
        imageSize: imageSize ?? "auto",
      },
      queuedAt: new Date(),
    },
  });

  // Submit to KIE.AI
  const callbackUrl = `${process.env.APP_URL ?? "https://artifacial.app"}/api/webhooks/kieai`;
  let kieAiTaskId: string;
  try {
    const result = await submitNanoBananaEdit({
      imageUrl: signedImageUrl,
      prompt,
      imageSize,
      outputFormat: "jpeg",
      callbackUrl,
    });
    kieAiTaskId = result.taskId;
  } catch (err) {
    await prisma.generation.update({
      where: { id: generation.id },
      data: {
        status: "FAILED",
        errorMessage: String(err),
        completedAt: new Date(),
      },
    });
    await refundCredits(session.user.id, CREDIT_COST, "Refund: Image edit submission failed");
    console.error("[edit] KIE.AI submission failed:", err);
    return NextResponse.json({ error: "Failed to submit image edit" }, { status: 500 });
  }

  // Update Generation with task ID and mark as processing
  await prisma.generation.update({
    where: { id: generation.id },
    data: {
      status: "PROCESSING",
      startedAt: new Date(),
      inputParams: {
        imageR2Key: body.imageR2Key,
        prompt,
        imageSize: imageSize ?? "auto",
        kieAiTaskId,
        submissionPath: "kieai",
      },
    },
  });

  console.log(`[edit] Submitted gen=${generation.id} kieAiTaskId=${kieAiTaskId}`);
  return NextResponse.json({ generationId: generation.id });
}
