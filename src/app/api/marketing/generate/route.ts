/**
 * POST /api/marketing/generate
 * Body: {
 *   url?: string,                    // product URL — scraped if provided
 *   product?: ProductInfo,           // already-scraped product (skips scrape)
 *   creatorImage?: string,           // base64 / R2 URL — required for ugc + tv-spot
 *   productImage?: string,           // override product image (base64 / R2 URL)
 *   mode: "ugc" | "tv-spot" | "hyper-motion",
 *   notes?: string,                  // optional creator direction
 * }
 * Returns: { generationId, scriptTaskId, hook, spokenScript, scenePrompt }
 *
 * Flow:
 *  1. Scrape (or use provided product)
 *  2. Resolve creator/product images to R2 URLs
 *  3. Call Claude to write the ad script
 *  4. Deduct 2,000 credits
 *  5. Submit to Kling 3.0 Omni with [creator?, product] images + scene prompt
 *  6. Create Generation row with inputParams.surface = "marketing-studio"
 *  7. Return generationId so client can poll via /api/workshop/poll
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deductCredits, refundCredits } from "@/lib/credits";
import { sanitizeClientError } from "@/lib/errors";
import { resolveImage } from "@/lib/uploads/resolve-image";
import { submitKling3OmniRouted } from "@/lib/generation/provider-router";
import { fetchProductFromUrl, type ProductInfo } from "@/lib/marketing/scraper";
import { writeAdScripts, type MarketingMode, type AdScript } from "@/lib/marketing/script-writer";
import type { Prisma } from "@/generated/prisma/client";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

const VALID_MODES: MarketingMode[] = ["ugc", "tv-spot", "hyper-motion"];
const CREDITS_PER_AD = 2000;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.user.id;

  let body: {
    url?: string;
    product?: ProductInfo;
    creatorImage?: string;
    productImage?: string;
    mode?: MarketingMode;
    notes?: string;
    variants?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const mode = body.mode && VALID_MODES.includes(body.mode) ? body.mode : null;
  if (!mode) return NextResponse.json({ error: "mode must be ugc, tv-spot, or hyper-motion" }, { status: 400 });

  const variantCount: 1 | 3 = body.variants === true ? 3 : 1;
  const totalCredits = CREDITS_PER_AD * variantCount;

  // 1. Resolve product info (scrape or use provided)
  let product: ProductInfo;
  if (body.product) {
    product = body.product;
  } else if (body.url) {
    try {
      product = await fetchProductFromUrl(body.url);
    } catch (err) {
      return NextResponse.json(
        { error: sanitizeClientError(err instanceof Error ? err.message : String(err), "marketing/scrape") },
        { status: 400 },
      );
    }
  } else {
    return NextResponse.json({ error: "Provide either `url` or `product`." }, { status: 400 });
  }

  // 2. Charge upfront for the full bundle (1 ad or 3-variant batch)
  const ok = await deductCredits(userId, totalCredits, `Marketing Studio: ${mode}${variantCount > 1 ? ` × ${variantCount}` : ""}`);
  if (!ok) return NextResponse.json({ error: `Insufficient credits — need ${totalCredits.toLocaleString()} cr.` }, { status: 402 });

  try {
    // 3. Resolve images to R2 URLs
    const productImageInput = body.productImage ?? product.imageUrl;
    const productUrl = await resolveImage(userId, productImageInput, "marketing");
    if (!productUrl) {
      throw new Error("No product image — provide productImage or a URL whose scraped image isn't empty");
    }

    // Creator image required for UGC + TV Spot, optional for Hyper Motion
    let creatorUrl: string | undefined;
    if (mode !== "hyper-motion") {
      creatorUrl = await resolveImage(userId, body.creatorImage, "marketing");
      if (!creatorUrl) {
        throw new Error(`Creator image is required for ${mode} mode`);
      }
    }

    // 4. Write the script(s) — single call to Claude for either 1 or 3 variants
    const scripts: AdScript[] = await writeAdScripts(
      { product: { ...product, imageUrl: productUrl }, mode, notes: body.notes },
      variantCount,
    );

    // 5. Submit each script as a separate Kling job in parallel.
    //    Failed submissions get individually refunded so users only pay for
    //    what actually ran.
    const images: string[] = mode === "hyper-motion" ? [productUrl] : [creatorUrl!, productUrl];
    const aspectRatio = (mode === "tv-spot" ? "16:9" : "9:16") as "9:16" | "16:9";
    const marketingBatchId = randomUUID();

    const submissions = await Promise.all(
      scripts.map(async (script, idx) => {
        const klingPrompt =
          mode === "hyper-motion"
            ? `@image_1 (the product) — ${script.scenePrompt}`
            : `@image_1 (the creator) holding/presenting @image_2 (the product). ${mode === "ugc" ? `The creator is saying: "${script.spokenScript}". ` : ""}${script.scenePrompt}`;

        try {
          const result = await submitKling3OmniRouted({
            prompt: klingPrompt,
            images,
            durationSeconds: 5,
            aspectRatio,
            resolution: "720p",
          });

          const gen = await prisma.generation.create({
            data: {
              userId,
              workflowType: "IMAGE_TO_VIDEO",
              status: "PROCESSING",
              contentMode: "SFW",
              provider: "PIAPI",
              modelId: "marketing-studio",
              creditsCost: CREDITS_PER_AD,
              withAudio: false,
              durationSec: 5,
              resolution: "720p",
              inputParams: {
                surface: "marketing-studio",
                mode,
                marketingBatchId: variantCount > 1 ? marketingBatchId : undefined,
                variantIndex: variantCount > 1 ? idx : undefined,
                productName: product.name,
                productBrand: product.brand,
                productSourceUrl: product.sourceUrl,
                productImageUrl: productUrl,
                creatorImageUrl: creatorUrl ?? null,
                hook: script.hook,
                spokenScript: script.spokenScript,
                scenePrompt: script.scenePrompt,
                klingPrompt,
                aspectRatio,
                piApiTaskId: result.provider === "piapi" ? result.taskId : undefined,
                kieAiTaskId:  result.provider === "kieai" ? result.taskId : undefined,
                routedProvider: result.provider,
                ...(result.fallbackReason ? { fallbackReason: result.fallbackReason } : {}),
                submissionPath: "marketing-studio",
              } as Prisma.InputJsonValue,
              startedAt: new Date(),
              queuedAt: new Date(),
            },
            select: { id: true },
          });

          return { ok: true as const, idx, generationId: gen.id, taskId: result.taskId, script };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[marketing/generate] variant ${idx} failed:`, msg);
          return { ok: false as const, idx, script, error: msg };
        }
      }),
    );

    const succeeded = submissions.filter((s) => s.ok);
    const failed = submissions.filter((s) => !s.ok);

    // Refund failed variants individually so users only pay for what shipped.
    if (failed.length > 0) {
      await refundCredits(userId, failed.length * CREDITS_PER_AD, `Refund: Marketing Studio ${failed.length}/${scripts.length} variants failed`);
    }
    if (succeeded.length === 0) {
      return NextResponse.json(
        { error: sanitizeClientError(failed[0]?.error ?? "All variants failed", "marketing/generate") },
        { status: 500 },
      );
    }

    // Response shape — single submission keeps the v1 contract, multi-variant
    // adds batchId + items[] like Photodump.
    if (variantCount === 1 && succeeded[0]) {
      const s = succeeded[0];
      return NextResponse.json({
        generationId: s.generationId,
        taskId: s.taskId,
        credits: CREDITS_PER_AD,
        mode,
        hook: s.script.hook,
        spokenScript: s.script.spokenScript,
        scenePrompt: s.script.scenePrompt,
        product: { name: product.name, brand: product.brand, sourceUrl: product.sourceUrl },
      });
    }

    return NextResponse.json({
      batchId: marketingBatchId,
      mode,
      creditsCharged: succeeded.length * CREDITS_PER_AD,
      failedCount: failed.length,
      items: succeeded.map((s) => ({
        variantIndex: s.idx,
        generationId: s.generationId,
        taskId: s.taskId,
        hook: s.script.hook,
        spokenScript: s.script.spokenScript,
      })),
      product: { name: product.name, brand: product.brand, sourceUrl: product.sourceUrl },
    });
  } catch (err) {
    await refundCredits(userId, totalCredits, `Refund: Marketing Studio ${mode} pipeline failed`);
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[marketing/generate]", msg);
    return NextResponse.json(
      { error: sanitizeClientError(msg, "marketing/generate") },
      { status: 400 },
    );
  }
}
