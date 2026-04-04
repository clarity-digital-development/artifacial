import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

// ─── Rewardful Webhook Payload Types ───

interface RewardfulAffiliate {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  [key: string]: unknown;
}

interface RewardfulSale {
  amount: number;         // subscription amount in cents
  currency: string;
  [key: string]: unknown;
}

interface RewardfulCommissionPayload {
  id: string;
  amount: number;         // commission amount in cents
  currency: string;
  affiliate: RewardfulAffiliate;
  sale?: RewardfulSale;
  [key: string]: unknown;
}

interface RewardfulWebhookEvent {
  event: string;
  data: RewardfulAffiliate | RewardfulCommissionPayload;
}

// ─── Signature Verification ───

function verifySignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.REWARDFUL_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[rewardful-webhook] REWARDFUL_WEBHOOK_SECRET is not set");
    return false;
  }
  if (!signatureHeader) return false;

  const expected = createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("hex");

  try {
    return timingSafeEqual(Buffer.from(signatureHeader, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

// ─── Event Handlers ───

/**
 * affiliate.created — Rewardful notifies us that a new affiliate signed up.
 * We match their email to a PENDING AgentApplication → create RewardfulAffiliate
 * linking them to the recruiting agent → mark the application APPROVED.
 */
async function handleAffiliateCreated(affiliate: RewardfulAffiliate): Promise<void> {
  const email = affiliate.email?.toLowerCase().trim();
  if (!email) return;

  // Find an application that's still PENDING for this email
  const application = await prisma.agentApplication.findFirst({
    where: { email, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });

  if (!application) {
    // No matching application — organic signup or already processed
    console.log(`[rewardful-webhook] affiliate.created: no pending application for ${email}`);
    return;
  }

  // Resolve the agent's Affiliate record via the stored agentCode
  const agentAffiliate = await prisma.affiliate.findUnique({
    where: { code: application.agentCode },
    select: { id: true, status: true, tier: true },
  });

  if (!agentAffiliate || agentAffiliate.status !== "ACTIVE" || agentAffiliate.tier !== "AGENT") {
    console.warn(
      `[rewardful-webhook] affiliate.created: agent with code ${application.agentCode} not found or not active`
    );
    return;
  }

  // Idempotency: skip if we already mapped this Rewardful affiliate
  const existing = await prisma.rewardfulAffiliate.findUnique({
    where: { rewardfulId: affiliate.id },
  });

  if (existing) {
    console.log(`[rewardful-webhook] affiliate.created: already mapped rewardfulId=${affiliate.id}`);
    return;
  }

  await prisma.$transaction([
    prisma.rewardfulAffiliate.create({
      data: {
        rewardfulId: affiliate.id,
        email,
        agentId: agentAffiliate.id,
      },
    }),
    prisma.agentApplication.update({
      where: { id: application.id },
      data: { status: "APPROVED" },
    }),
  ]);

  console.log(
    `[rewardful-webhook] affiliate.created: mapped rewardfulId=${affiliate.id} → agentId=${agentAffiliate.id}`
  );
}

/**
 * commission.created — A Rewardful affiliate earned a commission.
 * We find which agent recruited that affiliate and create a 10%-of-sale OVERRIDE
 * commission for the agent.
 *
 * Amount: 10% of the subscription sale amount (not 10% of the Rewardful commission).
 */
async function handleCommissionCreated(payload: RewardfulCommissionPayload): Promise<void> {
  const rewardfulAffiliateId = payload.affiliate?.id;
  const rewardfulCommissionId = payload.id;

  if (!rewardfulAffiliateId || !rewardfulCommissionId) return;

  // Idempotency — skip if we already processed this commission
  const existingCommission = await prisma.commission.findUnique({
    where: { rewardfulCommissionId },
  });
  if (existingCommission) {
    console.log(`[rewardful-webhook] commission.created: already processed ${rewardfulCommissionId}`);
    return;
  }

  // Find the agent linked to this Rewardful affiliate
  const rewardfulAffiliate = await prisma.rewardfulAffiliate.findUnique({
    where: { rewardfulId: rewardfulAffiliateId },
    include: {
      agent: { select: { id: true, status: true } },
    },
  });

  if (!rewardfulAffiliate) {
    // This affiliate was not recruited by an agent — no override needed
    console.log(
      `[rewardful-webhook] commission.created: no agent mapping for rewardfulAffiliateId=${rewardfulAffiliateId}`
    );
    return;
  }

  if (rewardfulAffiliate.agent.status !== "ACTIVE") {
    console.warn(
      `[rewardful-webhook] commission.created: agent ${rewardfulAffiliate.agentId} is not ACTIVE`
    );
    return;
  }

  // Sale amount in cents → USD; override = 10% of sale
  const saleAmountCents = payload.sale?.amount ?? 0;
  const saleAmountUsd = saleAmountCents / 100;
  const overrideAmount = saleAmountUsd * 0.1;
  const currency = (payload.sale?.currency ?? payload.currency ?? "usd").toLowerCase();

  const paysOutAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // NET-30

  // stripeInvoiceId is required/unique on Commission; use a namespaced placeholder
  const placeholderStripeId = `rewardful_${rewardfulCommissionId}`;

  await prisma.commission.create({
    data: {
      affiliateId: rewardfulAffiliate.agentId,
      type: "OVERRIDE",
      sourceAffiliateId: null, // no internal Affiliate for Rewardful affiliates
      referredUserId: null,
      stripeInvoiceId: placeholderStripeId,
      stripeSubscriptionId: `rewardful_sub_${rewardfulAffiliateId}`,
      stripeCustomerId: `rewardful_customer_${rewardfulAffiliateId}`,
      rewardfulCommissionId,
      subscriptionRevenue: saleAmountUsd,
      amount: overrideAmount,
      currency,
      monthNumber: 1, // month tracking not applicable for Rewardful-sourced overrides
      status: "PENDING",
      paysOutAt,
    },
  });

  console.log(
    `[rewardful-webhook] commission.created: override $${overrideAmount.toFixed(2)} for agent ${rewardfulAffiliate.agentId}`
  );
}

/**
 * commission.voided / commission.deleted — Claw back the corresponding override.
 */
async function handleCommissionVoided(payload: RewardfulCommissionPayload): Promise<void> {
  const rewardfulCommissionId = payload.id;
  if (!rewardfulCommissionId) return;

  const commission = await prisma.commission.findUnique({
    where: { rewardfulCommissionId },
  });

  if (!commission) {
    console.log(`[rewardful-webhook] commission.voided: no commission found for ${rewardfulCommissionId}`);
    return;
  }

  if (commission.status === "CLAWED_BACK") {
    console.log(`[rewardful-webhook] commission.voided: already clawed back ${rewardfulCommissionId}`);
    return;
  }

  await prisma.commission.update({
    where: { rewardfulCommissionId },
    data: { status: "CLAWED_BACK" },
  });

  console.log(`[rewardful-webhook] commission.voided: clawed back ${rewardfulCommissionId}`);
}

/**
 * commission.paid — Mark the override commission as APPROVED (eligible for payout).
 */
async function handleCommissionPaid(payload: RewardfulCommissionPayload): Promise<void> {
  const rewardfulCommissionId = payload.id;
  if (!rewardfulCommissionId) return;

  const commission = await prisma.commission.findUnique({
    where: { rewardfulCommissionId },
  });

  if (!commission) {
    console.log(`[rewardful-webhook] commission.paid: no commission found for ${rewardfulCommissionId}`);
    return;
  }

  if (commission.status === "PAID" || commission.status === "CLAWED_BACK") {
    return;
  }

  await prisma.commission.update({
    where: { rewardfulCommissionId },
    data: {
      status: "APPROVED",
      paidAt: new Date(),
    },
  });

  console.log(`[rewardful-webhook] commission.paid: approved ${rewardfulCommissionId}`);
}

// ─── Main Handler ───

export async function POST(req: Request): Promise<NextResponse> {
  const rawBody = await req.text();
  const signature = req.headers.get("x-rewardful-signature");

  if (!verifySignature(rawBody, signature)) {
    console.error("[rewardful-webhook] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: RewardfulWebhookEvent;
  try {
    event = JSON.parse(rawBody) as RewardfulWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { event: eventType, data } = event;

  try {
    switch (eventType) {
      case "affiliate.created":
        await handleAffiliateCreated(data as RewardfulAffiliate);
        break;

      case "commission.created":
        await handleCommissionCreated(data as RewardfulCommissionPayload);
        break;

      case "commission.voided":
      case "commission.deleted":
        await handleCommissionVoided(data as RewardfulCommissionPayload);
        break;

      case "commission.paid":
        await handleCommissionPaid(data as RewardfulCommissionPayload);
        break;

      default:
        // Unknown event type — acknowledge receipt but take no action
        console.log(`[rewardful-webhook] Unhandled event type: ${eventType}`);
    }
  } catch (err) {
    console.error(`[rewardful-webhook] Error handling ${eventType}:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
