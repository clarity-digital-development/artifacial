import Stripe from "stripe";

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
  imageGeneration: 10, // Per image (1 angle)
  characterCreation: 40, // 4 angles × 10
  videoPerSecond: 40, // Per second of video
  video5s: 200, // 5 × 40
  video10s: 400, // 10 × 40
} as const;

// ─── Plans (Phase 1 — monthly only, no annual, no Studio) ───

export const PLANS = {
  free: {
    name: "Free",
    credits: 100, // One-time grant, not monthly
    monthlyPrice: 0,
    stripePriceId: null,
    baseCredits: 100, // For strikethrough display
    bonusLabel: null,
  },
  starter: {
    name: "Starter",
    credits: 750,
    monthlyPrice: 1500, // $15
    stripePriceId: process.env.STRIPE_STARTER_PRICE_ID,
    baseCredits: 500, // Strikethrough: ~~500~~ 750
    bonusLabel: "+50% bonus credits",
  },
  creator: {
    name: "Creator",
    credits: 2_500,
    monthlyPrice: 5000, // $50
    stripePriceId: process.env.STRIPE_CREATOR_PRICE_ID,
    baseCredits: 1_750, // Strikethrough: ~~1,750~~ 2,500
    bonusLabel: "+43% bonus credits",
  },
  pro: {
    name: "Pro",
    credits: 6_000,
    monthlyPrice: 10000, // $100
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID,
    baseCredits: 4_000, // Strikethrough: ~~4,000~~ 6,000
    bonusLabel: "+50% bonus credits",
  },
} as const;

export type PlanKey = keyof typeof PLANS;

// ─── Credit Packs (Phase 1 — available to subscribed users only) ───

export const CREDIT_PACKS = {
  credit_pack: {
    name: "400 Credits",
    credits: 400,
    price: 999, // $9.99
    stripePriceId: process.env.STRIPE_CREDIT_PACK_PRICE_ID,
  },
  credit_pack_plus: {
    name: "1,000 Credits",
    credits: 1_000,
    price: 2499, // $24.99
    stripePriceId: process.env.STRIPE_CREDIT_PACK_PLUS_PRICE_ID,
  },
} as const;

export type CreditPackKey = keyof typeof CREDIT_PACKS;
