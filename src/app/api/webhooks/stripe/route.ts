import { NextRequest, NextResponse } from "next/server";
import { getStripe, PLANS, CREDIT_PACKS, type PlanKey } from "@/lib/stripe";
import { prisma } from "@/lib/db";

type CreditPackKey = keyof typeof CREDIT_PACKS;

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

      // Only grant credits for paid sessions
      if (session.payment_status !== "paid") break;

      if (session.mode === "subscription") {
        const plan = (session.metadata?.plan ?? "free") as PlanKey;
        const planConfig = PLANS[plan];
        await prisma.user.update({
          where: { id: userId },
          data: {
            plan,
            stripeCustomerId: session.customer as string,
            imageCredits: { increment: planConfig.imageCredits },
            videoCredits: { increment: planConfig.videoCredits },
          },
        });
        await prisma.creditTransaction.create({
          data: {
            userId,
            type: "subscription_grant",
            imageCredits: planConfig.imageCredits,
            videoCredits: planConfig.videoCredits,
            description: `${planConfig.name} plan subscription`,
          },
        });
      } else if (session.mode === "payment") {
        // Look up pack by key stored in metadata (not raw credit amounts)
        const packKey = session.metadata?.creditPackKey as CreditPackKey | undefined;
        const pack = packKey ? CREDIT_PACKS[packKey] : undefined;
        if (!pack) break;

        await prisma.user.update({
          where: { id: userId },
          data: {
            imageCredits: { increment: pack.imageCredits },
            videoCredits: { increment: pack.videoCredits },
          },
        });
        await prisma.creditTransaction.create({
          data: {
            userId,
            type: "purchase",
            imageCredits: pack.imageCredits,
            videoCredits: pack.videoCredits,
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

      await prisma.user.update({
        where: { id: user.id },
        data: {
          imageCredits: { increment: planConfig.imageCredits },
          videoCredits: { increment: planConfig.videoCredits },
        },
      });
      await prisma.creditTransaction.create({
        data: {
          userId: user.id,
          type: "subscription_grant",
          imageCredits: planConfig.imageCredits,
          videoCredits: planConfig.videoCredits,
          description: `Monthly ${planConfig.name} plan credit grant`,
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
      await prisma.user.updateMany({
        where: { stripeCustomerId: customerId },
        data: { plan: "free" },
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
