import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe, PLANS, CREDIT_PACKS, type PlanKey, type CreditPackKey } from "@/lib/stripe";
import { prisma } from "@/lib/db";
import type { SubscriptionTier } from "@/generated/prisma/client";

// ─── Affiliate Commission Helpers ───

/**
 * Calculate which billing month (1-indexed) this invoice represents
 * relative to the subscription's start date.
 */
function calcMonthNumber(subscriptionCreatedAt: Date, invoiceDate: Date): number {
  const diffMs = invoiceDate.getTime() - subscriptionCreatedAt.getTime();
  const diffMonths = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30.44));
  return Math.max(1, diffMonths + 1);
}

/**
 * Process affiliate (DIRECT) and agent (OVERRIDE) commissions for a paid invoice.
 * Called only for renewal invoices (billing_reason !== "subscription_create").
 */
async function processAffiliateCommissions(params: {
  affiliateId: string;
  agentId: string | null | undefined;
  subscriptionCreatedAt: Date;
  invoiceDate: Date;
  invoiceAmountUsd: number;
  stripeInvoiceId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  referredUserId?: string;
}): Promise<void> {
  const {
    affiliateId,
    agentId,
    subscriptionCreatedAt,
    invoiceDate,
    invoiceAmountUsd,
    stripeInvoiceId,
    stripeSubscriptionId,
    stripeCustomerId,
    referredUserId,
  } = params;

  const affiliate = await prisma.affiliate.findUnique({
    where: { id: affiliateId },
    select: { id: true, status: true },
  });

  if (!affiliate || affiliate.status !== "ACTIVE") return;

  const monthNumber = calcMonthNumber(subscriptionCreatedAt, invoiceDate);
  const paysOutAt = new Date(invoiceDate.getTime() + 30 * 24 * 60 * 60 * 1000); // NET-30

  // DIRECT commission: 20% of invoice, capped at 12 months
  if (monthNumber <= 12) {
    const directAmount = invoiceAmountUsd * 0.2;

    await prisma.commission.create({
      data: {
        affiliateId,
        type: "DIRECT",
        referredUserId: referredUserId ?? null,
        stripeInvoiceId,
        stripeSubscriptionId,
        stripeCustomerId,
        subscriptionRevenue: invoiceAmountUsd,
        amount: directAmount,
        currency: "usd",
        monthNumber,
        status: "PENDING",
        paysOutAt,
      },
    });

    // OVERRIDE commission for agent: 10% of the DIRECT commission, no month cap
    if (agentId) {
      const agent = await prisma.affiliate.findUnique({
        where: { id: agentId },
        select: { id: true, status: true },
      });

      if (agent && agent.status === "ACTIVE") {
        await prisma.commission.create({
          data: {
            affiliateId: agentId,
            type: "OVERRIDE",
            sourceAffiliateId: affiliateId,
            referredUserId: referredUserId ?? null,
            // Suffix invoice ID to avoid unique constraint collision
            stripeInvoiceId: `${stripeInvoiceId}_override`,
            stripeSubscriptionId,
            stripeCustomerId,
            subscriptionRevenue: invoiceAmountUsd,
            amount: directAmount * 0.1,
            currency: "usd",
            monthNumber,
            status: "PENDING",
            paysOutAt,
          },
        });
      }
    }
  } else {
    // Month > 12: DIRECT commission is capped, but OVERRIDE is NOT
    if (agentId) {
      // We still need a "base" direct amount to derive the override from,
      // even though no DIRECT commission is created.
      const hypotheticalDirect = invoiceAmountUsd * 0.2;
      const overrideAmount = hypotheticalDirect * 0.1;

      const agent = await prisma.affiliate.findUnique({
        where: { id: agentId },
        select: { id: true, status: true },
      });

      if (agent && agent.status === "ACTIVE") {
        await prisma.commission.create({
          data: {
            affiliateId: agentId,
            type: "OVERRIDE",
            sourceAffiliateId: affiliateId,
            referredUserId: referredUserId ?? null,
            stripeInvoiceId: `${stripeInvoiceId}_override`,
            stripeSubscriptionId,
            stripeCustomerId,
            subscriptionRevenue: invoiceAmountUsd,
            amount: overrideAmount,
            currency: "usd",
            monthNumber,
            status: "PENDING",
            paysOutAt,
          },
        });
      }
    }
  }
}

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

      const customerId = invoice.customer as string;
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: customerId },
      });
      if (!user) break;

      // ── Credit renewal (skip first invoice — checkout.session.completed handled it) ──
      if (invoice.billing_reason !== "subscription_create") {
        const tier = user.subscriptionTier as PlanKey;
        const planConfig = PLANS[tier];

        if (tier !== "FREE") {
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
        }
      }

      // ── Affiliate commissions ──
      // Attribution is stored on the Stripe subscription metadata (set in
      // customer.subscription.created). Access via invoice.parent.subscription_details.
      const rawSubscription = invoice.parent?.subscription_details?.subscription;
      const subscriptionId =
        typeof rawSubscription === "string"
          ? rawSubscription
          : (rawSubscription as Stripe.Subscription | null)?.id;

      if (subscriptionId) {
        const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
        const meta = subscription.metadata ?? {};
        const affId = meta.affiliateId;
        const agentId = meta.agentId ?? null;
        const subCreatedAtRaw = meta.subscriptionCreatedAt;

        if (affId) {
          const subscriptionCreatedAt = subCreatedAtRaw
            ? new Date(Number(subCreatedAtRaw) * 1000)
            : new Date(subscription.created * 1000);

          const invoiceDate = new Date(
            (invoice.created ?? Math.floor(Date.now() / 1000)) * 1000
          );

          const invoiceAmountUsd = (invoice.amount_paid ?? 0) / 100;

          if (invoiceAmountUsd > 0) {
            await processAffiliateCommissions({
              affiliateId: affId,
              agentId,
              subscriptionCreatedAt,
              invoiceDate,
              invoiceAmountUsd,
              stripeInvoiceId: invoice.id,
              stripeSubscriptionId: subscriptionId,
              stripeCustomerId: customerId,
              referredUserId: user.id,
            }).catch((err) => {
              // Log but don't fail the webhook — credits already granted
              console.error("[affiliate-commission-error]", err);
            });
          }
        }
      }

      break;
    }

    case "customer.subscription.created": {
      // Store subscription start date + affiliate attribution in Stripe metadata
      // so future invoice.paid events can calculate month numbers correctly.
      const subscription = event.data.object;
      const customerId = subscription.customer as string;

      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: customerId },
        select: { id: true, referredByAffiliateId: true },
      });

      if (!user) break;

      // Resolve the referring affiliate and their parent agent
      if (user.referredByAffiliateId) {
        const referringAffiliate = await prisma.affiliate.findUnique({
          where: { id: user.referredByAffiliateId },
          select: { id: true, parentAffiliateId: true },
        });

        if (referringAffiliate) {
          const metaToSet: Record<string, string> = {
            affiliateId: referringAffiliate.id,
            subscriptionCreatedAt: String(subscription.created),
          };

          if (referringAffiliate.parentAffiliateId) {
            metaToSet.agentId = referringAffiliate.parentAffiliateId;
          }

          await getStripe().subscriptions.update(subscription.id, {
            metadata: {
              ...subscription.metadata,
              ...metaToSet,
            },
          });
        }
      } else {
        // Even without an affiliate, stamp the start time for potential future use
        await getStripe().subscriptions.update(subscription.id, {
          metadata: {
            ...subscription.metadata,
            subscriptionCreatedAt: String(subscription.created),
          },
        });
      }

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
