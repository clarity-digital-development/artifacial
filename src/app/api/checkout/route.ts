import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStripe, PLANS, CREDIT_PACKS, type PlanKey, type CreditPackKey } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type, key, referral, billing } = (await req.json()) as {
    type: "subscription" | "credit_pack";
    key: string;
    referral?: string;
    billing?: "monthly" | "annual";
  };

  const origin = req.headers.get("origin") ?? process.env.NEXTAUTH_URL ?? "";

  if (type === "subscription") {
    const plan = PLANS[key as PlanKey];
    // Use annual price if requested (or if plan is annual-only), fall back to monthly
    const priceId = billing === "annual"
      ? (plan?.stripeAnnualPriceId ?? plan?.stripePriceId)
      : (plan?.stripePriceId ?? plan?.stripeAnnualPriceId);
    if (!plan || !priceId) {
      console.error("[checkout] No price ID for plan:", key, "billing:", billing, "stripePriceId:", plan?.stripePriceId, "annualPriceId:", plan?.stripeAnnualPriceId);
      return NextResponse.json({ error: "Invalid plan or no Stripe price configured" }, { status: 400 });
    }

    try {
      const checkoutSession = await getStripe().checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: {
          userId: session.user.id,
          tier: key,
        },
        ...(referral ? { client_reference_id: referral } : {}),
        success_url: `${origin}/settings?upgraded=true`,
        cancel_url: `${origin}/settings`,
      });
      return NextResponse.json({ url: checkoutSession.url });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stripe checkout failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (type === "credit_pack") {
    // Credit packs only available to subscribed users
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { subscriptionTier: true },
    });

    if (!user || user.subscriptionTier === "FREE") {
      return NextResponse.json(
        { error: "Subscribe to a plan before purchasing credit packs" },
        { status: 403 }
      );
    }

    const pack = CREDIT_PACKS[key as CreditPackKey];
    if (!pack || !pack.stripePriceId) {
      return NextResponse.json({ error: "Invalid credit pack" }, { status: 400 });
    }

    try {
      const checkoutSession = await getStripe().checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [{ price: pack.stripePriceId, quantity: 1 }],
        metadata: {
          userId: session.user.id,
          creditPackKey: key,
        },
        ...(referral ? { client_reference_id: referral } : {}),
        success_url: `${origin}/settings?purchased=true`,
        cancel_url: `${origin}/settings`,
      });
      return NextResponse.json({ url: checkoutSession.url });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Stripe checkout failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
