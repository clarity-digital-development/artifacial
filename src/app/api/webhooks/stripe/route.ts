import { NextRequest, NextResponse } from "next/server";
import { getStripe, PLANS, CREDIT_PACKS, type PlanKey, type CreditPackKey } from "@/lib/stripe";
import { prisma } from "@/lib/db";

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
        const plan = (session.metadata?.plan ?? "free") as PlanKey;
        const planConfig = PLANS[plan];

        // Set founding member status (Phase 1 beta perk)
        const priceId = session.subscription
          ? (await getStripe().subscriptions.retrieve(session.subscription as string))
              .items.data[0]?.price?.id
          : undefined;

        await prisma.user.update({
          where: { id: userId },
          data: {
            plan,
            stripeCustomerId: session.customer as string,
            subscriptionCredits: planConfig.credits,
            // Mark as founding member on first Phase 1 subscription
            isFoundingMember: true,
            foundingMemberPlan: plan,
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

        // Credit packs go to purchasedCredits (roll over indefinitely)
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

      const plan = user.plan as PlanKey;
      const planConfig = PLANS[plan];
      if (plan === "free") break;

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

      // Resolve plan from the subscription's price ID
      const priceId = subscription.items.data[0]?.price?.id;
      const newPlan = Object.entries(PLANS).find(
        ([, config]) => config.stripePriceId === priceId
      );
      if (newPlan) {
        await prisma.user.update({
          where: { id: user.id },
          data: { plan: newPlan[0] },
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
        data: { plan: "free", subscriptionCredits: 0 },
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
