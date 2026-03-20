import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildCharacterPrompts, generateImageWithGemini } from "@/lib/gemini";
import { isFalImageModel, generateImageWithFal, getFalImageModel, type FalImageModelId } from "@/lib/fal-image";
import { uploadToR2, r2KeyForCharacterImage, r2KeyForUpload, getSignedR2Url } from "@/lib/r2";
import { CREDIT_COSTS } from "@/lib/stripe";
import { getAvailableCredits, deductCredits, refundCredits } from "@/lib/credits";

const ANGLE_NAMES = ["front", "left", "right", "full"];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const formData = await req.formData();
  const name = formData.get("name") as string;
  const style = formData.get("style") as string;
  const mode = formData.get("mode") as string;
  const description = (formData.get("description") as string) ?? "";
  const model = (formData.get("model") as string) ?? "";
  const aspectRatio = (formData.get("aspectRatio") as string) ?? "1:1";
  const photoFile = formData.get("photo") as File | null;

  // Calculate cost based on model
  const useFal = isFalImageModel(model);
  const falModel = useFal ? getFalImageModel(model) : null;
  const perImageCost = falModel?.creditCost ?? CREDIT_COSTS.imageGeneration;
  const cost = 4 * perImageCost; // 4 angles

  // Check credits
  const { total } = await getAvailableCredits(userId);
  if (total < cost) {
    return NextResponse.json(
      {
        error: "insufficient_credits",
        required: cost,
        available: total,
      },
      { status: 403 }
    );
  }

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Create character record
  const character = await prisma.character.create({
    data: {
      userId,
      name: name.trim(),
      description: description.trim() || null,
      style,
      referenceImages: [],
    },
  });

  // Upload source photo if provided
  let referenceImageBase64: string | undefined;
  if (mode === "photo" && photoFile) {
    const bytes = new Uint8Array(await photoFile.arrayBuffer());
    const key = r2KeyForUpload(userId, character.id, "source.jpg");
    await uploadToR2(key, Buffer.from(bytes), photoFile.type);
    await prisma.character.update({
      where: { id: character.id },
      data: { sourceImage: key },
    });
    referenceImageBase64 = Buffer.from(bytes).toString("base64");
  }

  // Debit credits upfront
  await deductCredits(userId, cost, `Character generation: ${name.trim()}`, "character_debit");

  // Build prompts
  const promptDescription = description.trim() || name.trim();
  const prompts = buildCharacterPrompts(style, promptDescription);

  // Stream results via SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      const referenceImageKeys: string[] = [];

      // Generate all 4 angles concurrently
      const results = await Promise.allSettled(
        prompts.map(async (prompt, index) => {
          try {
            const imageBuffer = useFal
              ? await generateImageWithFal(prompt, model as FalImageModelId, aspectRatio)
              : await generateImageWithGemini(
                  prompt,
                  referenceImageBase64,
                  model,
                  aspectRatio
                );
            const key = r2KeyForCharacterImage(
              userId,
              character.id,
              ANGLE_NAMES[index]
            );
            await uploadToR2(key, imageBuffer, "image/webp");
            const signedUrl = await getSignedR2Url(key, 86400);
            referenceImageKeys[index] = key;
            send({ type: "image", index, url: signedUrl });
          } catch (err) {
            send({
              type: "error",
              index,
              message:
                err instanceof Error ? err.message : "Generation failed",
            });
          }
        })
      );

      // Update character with generated image keys
      const successfulKeys = referenceImageKeys.filter(Boolean);
      if (successfulKeys.length > 0) {
        await prisma.character.update({
          where: { id: character.id },
          data: { referenceImages: successfulKeys },
        });
      }

      // Refund credits for failed generations
      const failedCount = results.filter(
        (r) => r.status === "rejected"
      ).length;
      if (failedCount > 0) {
        const refundAmount = failedCount * perImageCost;
        await refundCredits(
          userId,
          refundAmount,
          `Refund for ${failedCount} failed generation(s)`
        );
      }

      send({ type: "complete", characterId: character.id });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
