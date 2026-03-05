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

export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    imageCredits: 8,
    videoCredits: 2,
    stripePriceId: null,
  },
  starter: {
    name: "Starter",
    price: 999,
    imageCredits: 30,
    videoCredits: 15,
    stripePriceId: process.env.STRIPE_STARTER_PRICE_ID,
  },
  creator: {
    name: "Creator",
    price: 1999,
    imageCredits: 50,
    videoCredits: 30,
    stripePriceId: process.env.STRIPE_CREATOR_PRICE_ID,
  },
  pro: {
    name: "Pro",
    price: 2999,
    imageCredits: 80,
    videoCredits: 50,
    stripePriceId: process.env.STRIPE_PRO_PRICE_ID,
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export const CREDIT_PACKS = {
  image_20: {
    name: "20 Image Credits",
    imageCredits: 20,
    videoCredits: 0,
    price: 299,
    stripePriceId: process.env.STRIPE_IMAGE_PACK_PRICE_ID,
  },
  video_10: {
    name: "10 Video Credits",
    imageCredits: 0,
    videoCredits: 10,
    price: 499,
    stripePriceId: process.env.STRIPE_VIDEO_PACK_10_PRICE_ID,
  },
  video_30: {
    name: "30 Video Credits",
    imageCredits: 0,
    videoCredits: 30,
    price: 1299,
    stripePriceId: process.env.STRIPE_VIDEO_PACK_30_PRICE_ID,
  },
} as const;
