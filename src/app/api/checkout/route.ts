import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStripe, PLANS, CREDIT_PACKS, type PlanKey, type CreditPackKey } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type, key } = (await req.json()) as {
    type: "subscription" | "credit_pack";
    key: string;
  };

  const origin = req.headers.get("origin") ?? process.env.NEXTAUTH_URL ?? "";

  if (type === "subscription") {
    const plan = PLANS[key as PlanKey];
    if (!plan || !plan.stripePriceId) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const checkoutSession = await getStripe().checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: plan.stripePriceId, quantity: 1 }],
      metadata: {
        userId: session.user.id,
        plan: key,
      },
      success_url: `${origin}/settings?upgraded=true`,
      cancel_url: `${origin}/settings`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  }

  if (type === "credit_pack") {
    // Credit packs only available to subscribed users
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { plan: true },
    });

    if (!user || user.plan === "free") {
      return NextResponse.json(
        { error: "Subscribe to a plan before purchasing credit packs" },
        { status: 403 }
      );
    }

    const pack = CREDIT_PACKS[key as CreditPackKey];
    if (!pack || !pack.stripePriceId) {
      return NextResponse.json({ error: "Invalid credit pack" }, { status: 400 });
    }

    const checkoutSession = await getStripe().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{ price: pack.stripePriceId, quantity: 1 }],
      metadata: {
        userId: session.user.id,
        creditPackKey: key,
      },
      success_url: `${origin}/settings?purchased=true`,
      cancel_url: `${origin}/settings`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}
