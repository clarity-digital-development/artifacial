import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildCharacterPrompts } from "@/lib/gemini";
import { generateImageWithPiApi, getPiApiImageModel, type PiApiImageModelId } from "@/lib/piapi-image";
import { generateVeniceImage } from "@/lib/venice";
import { getModelById } from "@/lib/models/registry";
import { uploadToR2, r2KeyForCharacterImage, r2KeyForUpload, getSignedR2Url } from "@/lib/r2";

import { getAvailableCredits, deductCredits, refundCredits } from "@/lib/credits";

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
  const quality = ((formData.get("quality") as string) ?? "1k") as "1k" | "2k";
  const countRaw = parseInt((formData.get("count") as string) ?? "1");
  const count = [1, 2, 4].includes(countRaw) ? countRaw : 1;
  const photoFile = formData.get("photo") as File | null;

  console.log(`[char-gen] POST: user=${userId}, model=${model}, mode=${mode}, style=${style}, aspectRatio=${aspectRatio}, count=${count}, hasPhoto=${!!photoFile}`);

  // Look up model from registry (supports both PiAPI and Venice)
  const registryModel = getModelById(model);
  const piApiModel = getPiApiImageModel(model);

  if (!registryModel && !piApiModel) {
    return NextResponse.json({ error: `Unknown image model: ${model}` }, { status: 400 });
  }

  const isVenice = registryModel?.provider === "VENICE";
  const perImageCost = registryModel?.creditCost ?? piApiModel!.creditCost;
  const cost = perImageCost * count;

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

  // Create primary character record
  const primaryCharacter = await prisma.character.create({
    data: {
      userId,
      name: name.trim(),
      description: description.trim() || null,
      style,
      referenceImages: [],
    },
  });

  // Upload source photo if provided (using primary character's ID for the key)
  let sourceImageKey: string | undefined;
  let referenceImageBuffer: Buffer | undefined;
  if (mode === "photo" && photoFile) {
    const bytes = new Uint8Array(await photoFile.arrayBuffer());
    const photoBuffer = Buffer.from(bytes);
    const key = r2KeyForUpload(userId, primaryCharacter.id, "source.jpg");
    await uploadToR2(key, photoBuffer, photoFile.type);
    await prisma.character.update({
      where: { id: primaryCharacter.id },
      data: { sourceImage: key },
    });
    sourceImageKey = key;
    referenceImageBuffer = photoBuffer;
    console.log(`[char-gen] Uploaded source photo: key=${key}, size=${photoBuffer.length}`);
  }

  // For count > 1, create additional character records (each gets its own image)
  const additionalCharacters =
    count > 1
      ? await Promise.all(
          Array.from({ length: count - 1 }, () =>
            prisma.character.create({
              data: {
                userId,
                name: name.trim(),
                description: description.trim() || null,
                style,
                referenceImages: [],
                ...(sourceImageKey ? { sourceImage: sourceImageKey } : {}),
              },
            })
          )
        )
      : [];

  const allCharacters = [primaryCharacter, ...additionalCharacters];

  // Debit credits upfront
  await deductCredits(userId, cost, `Character generation: ${name.trim()}`, "character_debit");

  // Build prompt (same prompt for all images)
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

      // Track success per index for credit refunds
      const successFlags: boolean[] = Array(count).fill(false);

      // Generate one image per character, concurrently
      await Promise.all(
        allCharacters.map(async (char, index) => {
          const prompt = prompts[0];
          try {
            let imageBuffer: Buffer;

            if (isVenice && registryModel?.veniceConfig) {
              imageBuffer = await generateVeniceImage({
                model: registryModel.veniceConfig.model,
                prompt,
                aspectRatio,
                safeMode: false,
              });
            } else {
              imageBuffer = await generateImageWithPiApi(
                prompt,
                model as PiApiImageModelId,
                aspectRatio,
                referenceImageBuffer,
                quality
              );
            }

            const key = r2KeyForCharacterImage(userId, char.id, "main");
            await uploadToR2(key, imageBuffer, "image/webp");

            await prisma.character.update({
              where: { id: char.id },
              data: { referenceImages: [key] },
            });

            const signedUrl = await getSignedR2Url(key, 86400);
            successFlags[index] = true;
            send({ type: "image", index, url: signedUrl, characterId: char.id });
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            const errDetail =
              err instanceof Error && (err as unknown as Record<string, unknown>).body
                ? JSON.stringify((err as unknown as Record<string, unknown>).body).slice(0, 500)
                : "";
            console.error(
              `[char-gen] Generation failed: index=${index}, model=${model}, error=${errMsg}`,
              errDetail ? `body=${errDetail}` : ""
            );
            // Delete the empty character record so it doesn't pollute the library
            await prisma.character.delete({ where: { id: char.id } }).catch(() => {});
            send({ type: "error", index, message: errMsg });
          }
        })
      );

      // Refund credits for any failed generations
      const failedCount = successFlags.filter((f) => !f).length;
      if (failedCount > 0) {
        const refundAmount = failedCount * perImageCost;
        await refundCredits(
          userId,
          refundAmount,
          `Refund for ${failedCount} failed generation(s)`
        );
      }

      const successfulIds = allCharacters
        .filter((_, i) => successFlags[i])
        .map((c) => c.id);

      send({
        type: "complete",
        characterId: successfulIds[0] ?? primaryCharacter.id,
        characterIds: successfulIds,
      });
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
