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
import { writeAdScript, type MarketingMode } from "@/lib/marketing/script-writer";
import type { Prisma } from "@/generated/prisma/client";

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
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const mode = body.mode && VALID_MODES.includes(body.mode) ? body.mode : null;
  if (!mode) return NextResponse.json({ error: "mode must be ugc, tv-spot, or hyper-motion" }, { status: 400 });

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

  // 2. Charge upfront
  const ok = await deductCredits(userId, CREDITS_PER_AD, `Marketing Studio: ${mode}`);
  if (!ok) return NextResponse.json({ error: "Insufficient credits — need 2,000 cr." }, { status: 402 });

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

    // 4. Write the script (Claude)
    const script = await writeAdScript({
      product: { ...product, imageUrl: productUrl },
      mode,
      notes: body.notes,
    });

    // 5. Submit to Kling 3.0 Omni
    //   - UGC: [creator, product], 9:16, prompt references @image_1 (creator) + @image_2 (product)
    //   - TV Spot: [creator, product], 16:9
    //   - Hyper Motion: [product], 9:16, product-hero (no human)
    const images: string[] =
      mode === "hyper-motion" ? [productUrl] : [creatorUrl!, productUrl];
    const aspectRatio = mode === "tv-spot" ? "16:9" : "9:16";

    // Build the full Kling prompt with image references
    const klingPrompt =
      mode === "hyper-motion"
        ? `@image_1 (the product) — ${script.scenePrompt}`
        : `@image_1 (the creator) holding/presenting @image_2 (the product). ${mode === "ugc" ? `The creator is saying: "${script.spokenScript}". ` : ""}${script.scenePrompt}`;

    const result = await submitKling3OmniRouted({
      prompt: klingPrompt,
      images,
      durationSeconds: 5,
      aspectRatio: aspectRatio as "9:16" | "16:9",
      resolution: "720p",
    });

    // 6. Create Generation row
    const gen = await prisma.generation.create({
      data: {
        userId,
        workflowType: "IMAGE_TO_VIDEO",
        status: "PROCESSING",
        contentMode: "SFW",
        // KIE.AI doesn't have its own GenerationProvider enum value — both
        // routing endpoints flow through our PIAPI-style polling helpers, so
        // we use PIAPI as the umbrella and stash the actual routed provider
        // in inputParams.routedProvider for audit.
        provider: "PIAPI",
        modelId: "marketing-studio",
        creditsCost: CREDITS_PER_AD,
        withAudio: false,
        durationSec: 5,
        resolution: "720p",
        inputParams: {
          surface: "marketing-studio",
          mode,
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

    return NextResponse.json({
      generationId: gen.id,
      taskId: result.taskId,
      credits: CREDITS_PER_AD,
      mode,
      hook: script.hook,
      spokenScript: script.spokenScript,
      scenePrompt: script.scenePrompt,
      product: {
        name: product.name,
        brand: product.brand,
        sourceUrl: product.sourceUrl,
      },
    });
  } catch (err) {
    await refundCredits(userId, CREDITS_PER_AD, `Refund: Marketing Studio ${mode} submission failed`);
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[marketing/generate]", msg);
    return NextResponse.json(
      { error: sanitizeClientError(msg, "marketing/generate") },
      { status: 400 },
    );
  }
}
