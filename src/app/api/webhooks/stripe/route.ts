import { NextRequest, NextResponse } from "next/server";
import { getStripe, PLANS, CREDIT_PACKS, type PlanKey, type CreditPackKey } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import type { SubscriptionTier } from "@/generated/prisma/client";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature")!;

  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      if (!userId) break;

      if (session.payment_status !== "paid") break;

      if (session.mode === "subscription") {
        const tier = (session.metadata?.tier ?? "FREE") as PlanKey;
        const planConfig = PLANS[tier];

        // Get the subscription price ID for founding member tracking
        const priceId = session.subscription
          ? (await getStripe().subscriptions.retrieve(session.subscription as string))
              .items.data[0]?.price?.id
          : undefined;

        // Add plan credits on top of any existing balance (preserves unused free credits)
        await prisma.user.update({
          where: { id: userId },
          data: {
            subscriptionTier: tier as SubscriptionTier,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: typeof session.subscription === "string"
              ? session.subscription
              : null,
            subscriptionCredits: { increment: planConfig.credits },
            isFoundingMember: true,
            foundingMemberPlan: tier,
            ...(priceId ? { foundingMemberPriceId: priceId } : {}),
          },
        });
        await prisma.creditTransaction.create({
          data: {
            userId,
            type: "subscription_grant",
            credits: planConfig.credits,
            description: `${planConfig.name} plan subscription`,
          },
        });
      } else if (session.mode === "payment") {
        const packKey = session.metadata?.creditPackKey as CreditPackKey | undefined;
        const pack = packKey ? CREDIT_PACKS[packKey] : undefined;
        if (!pack) break;

        await prisma.user.update({
          where: { id: userId },
          data: {
            purchasedCredits: { increment: pack.credits },
          },
        });
        await prisma.creditTransaction.create({
          data: {
            userId,
            type: "purchase",
            credits: pack.credits,
            description: `${pack.name} purchase`,
          },
        });
      }
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object;

      // Skip the first invoice — checkout.session.completed already granted credits
      if (invoice.billing_reason === "subscription_create") break;

      const customerId = invoice.customer as string;
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: customerId },
      });
      if (!user) break;

      const tier = user.subscriptionTier as PlanKey;
      const planConfig = PLANS[tier];
      if (tier === "FREE") break;

      // Reset subscription credits to plan amount (no rollover)
      await prisma.user.update({
        where: { id: user.id },
        data: {
          subscriptionCredits: planConfig.credits,
        },
      });
      await prisma.creditTransaction.create({
        data: {
          userId: user.id,
          type: "subscription_grant",
          credits: planConfig.credits,
          description: `${planConfig.name} plan credit renewal`,
        },
      });
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const customerId = subscription.customer as string;
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: customerId },
      });
      if (!user) break;

      // Resolve tier from the subscription's price ID
      const priceId = subscription.items.data[0]?.price?.id;
      const matchedTier = (Object.entries(PLANS) as [PlanKey, typeof PLANS[PlanKey]][]).find(
        ([, config]) => config.stripePriceId === priceId || config.stripeAnnualPriceId === priceId
      );
      if (matchedTier) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            subscriptionTier: matchedTier[0] as SubscriptionTier,
            stripeSubscriptionId: subscription.id,
          },
        });
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const customerId = subscription.customer as string;
      // Revert to free, zero out subscription credits (purchased credits kept)
      await prisma.user.updateMany({
        where: { stripeCustomerId: customerId },
        data: { subscriptionTier: "FREE", subscriptionCredits: 0, stripeSubscriptionId: null },
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
