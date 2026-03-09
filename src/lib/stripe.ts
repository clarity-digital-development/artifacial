import Stripe from "stripe";
import type { SubscriptionTier, WorkflowType } from "@/generated/prisma/client";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-02-25.clover",
      typescript: true,
    });
  }
  return _stripe;
}

// ─── Credit Costs ───

export const CREDIT_COSTS = {
  imageGeneration: 10,     // Per image (1 angle)
  characterCreation: 40,   // 4 angles × 10
  videoPerSecond: 40,      // Per second of video
  video5s: 200,            // 5 × 40
  video10s: 400,           // 10 × 40
  upscale720p: 10,         // Quality enhance
  upscale1080p: 20,        // Creator+
  upscale1440p: 30,        // Pro+
} as const;

/**
 * Calculate credit cost for a generation job.
 */
export function calculateCreditCost(
  workflowType: WorkflowType,
  durationSec: number,
  resolution: string = "720p"
): number {
  if (workflowType === "UPSCALE") {
    if (resolution === "1440p") return CREDIT_COSTS.upscale1440p;
    if (resolution === "1080p") return CREDIT_COSTS.upscale1080p;
    return CREDIT_COSTS.upscale720p;
  }
  return CREDIT_COSTS.videoPerSecond * durationSec;
}

// ─── Resolution Gating by Tier ───

export const TIER_MAX_RESOLUTION: Record<SubscriptionTier, string> = {
  FREE: "720p",
  STARTER: "720p",
  CREATOR: "1080p",
  PRO: "1440p",
  STUDIO: "1440p",
};

export function canUseResolution(tier: SubscriptionTier, resolution: string): boolean {
  const order = ["720p", "1080p", "1440p"];
  const maxIdx = order.indexOf(TIER_MAX_RESOLUTION[tier]);
  const reqIdx = order.indexOf(resolution);
  return reqIdx >= 0 && reqIdx <= maxIdx;
}

// ─── Queue Priority by Tier ───

export const TIER_QUEUE_PRIORITY: Record<SubscriptionTier, number> = {
  STUDIO: 1,
  PRO: 2,
  CREATOR: 3,
  STARTER: 4,
  FREE: 5,
};

// ─── Plans ───

export type PlanKey = "FREE" | "STARTER" | "CREATOR" | "PRO" | "STUDIO";

export const PLANS: Record<PlanKey, {
  name: string;
  credits: number;
  monthlyPrice: number;
  annualMonthlyPrice: number | null;
  stripePriceId: string | null | undefined;
  stripeAnnualPriceId: string | null | undefined;
  baseCredits: number;
  bonusLabel: string | null;
}> = {
  FREE: {
    name: "Free",
    credits: 100,
    monthlyPrice: 0,
    annualMonthlyPrice: null,
    stripePriceId: null,
    stripeAnnualPriceId: null,
    baseCredits: 100,
    bonusLabel: null,
  },
  STARTER: {
    name: "Starter",
    credits: 1_500,
    monthlyPrice: 1500,
    annualMonthlyPrice: null, // No annual for Starter
    stripePriceId: process.env.STRIPE_STARTER_PRICE_ID,
    stripeAnnualPriceId: null,
    baseCredits: 1_000,
    bonusLabel: "+50% bonus credits",
  },
  CREATOR: {
    name: "Creator",
    credits: 5_000,
    monthlyPrice: 5000,
    annualMonthlyPrice: 4000, // $40/mo billed annually
    stripePriceId: process.env.STRIPE_CREATOR_PRICE_ID,
    stripeAnnualPriceId: process.env.STRIPE_CREATOR_ANNUAL_PRICE_ID,
    baseCredits: 3_500,
    bonusLabel: "+43% bonus credits",
  },
  PRO: {
    name: "Pro",
    credits: 15_000,
    monthlyPrice: 10000,
    annualMonthlyPrice: 8000, // $80/mo billed annually
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID,
    stripeAnnualPriceId: process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
    baseCredits: 10_000,
    bonusLabel: "+50% bonus credits",
  },
  STUDIO: {
    name: "Studio",
    credits: 50_000,
    monthlyPrice: 16500, // $165/mo (annual only)
    annualMonthlyPrice: 16500,
    stripePriceId: null, // Annual only
    stripeAnnualPriceId: process.env.STRIPE_STUDIO_ANNUAL_PRICE_ID,
    baseCredits: 35_000,
    bonusLabel: "Unlimited image gen",
  },
};

// ─── Credit Packs (available to subscribed users only) ───

export const CREDIT_PACKS = {
  credit_pack: {
    name: "500 Credits",
    credits: 500,
    price: 999, // $9.99
    stripePriceId: process.env.STRIPE_CREDIT_PACK_PRICE_ID,
  },
  credit_pack_plus: {
    name: "1,250 Credits",
    credits: 1_250,
    price: 2499, // $24.99
    stripePriceId: process.env.STRIPE_CREDIT_PACK_PLUS_PRICE_ID,
  },
} as const;

export type CreditPackKey = keyof typeof CREDIT_PACKS;
