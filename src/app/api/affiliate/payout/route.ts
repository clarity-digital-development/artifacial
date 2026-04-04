import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { createPayPalPayout } from "@/lib/paypal";

const MIN_PAYOUT_USD = 50.0;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const affiliate = await prisma.affiliate.findUnique({
    where: { userId: session.user.id },
  });

  if (!affiliate) {
    return NextResponse.json({ error: "No affiliate account found" }, { status: 404 });
  }

  if (affiliate.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Your affiliate account must be active to request a payout" },
      { status: 403 }
    );
  }

  if (!affiliate.payoutMethod) {
    return NextResponse.json(
      { error: "You must set a payout method before requesting a payout" },
      { status: 400 }
    );
  }

  let body: { method?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { method } = body;

  if (!method || !["STRIPE", "PAYPAL"].includes(method)) {
    return NextResponse.json(
      { error: "method must be STRIPE or PAYPAL" },
      { status: 400 }
    );
  }

  // Validate payout method matches what affiliate has configured
  if (method === "STRIPE" && !affiliate.stripeAccountId) {
    return NextResponse.json(
      { error: "No Stripe Connect account configured" },
      { status: 400 }
    );
  }

  if (method === "PAYPAL" && !affiliate.paypalEmail) {
    return NextResponse.json(
      { error: "No PayPal email configured" },
      { status: 400 }
    );
  }

  // Fetch all APPROVED commissions for this affiliate
  const approvedCommissions = await prisma.commission.findMany({
    where: {
      affiliateId: affiliate.id,
      status: "APPROVED",
      payoutRequestId: null, // not already in a pending payout
    },
  });

  if (approvedCommissions.length === 0) {
    return NextResponse.json(
      { error: "No approved commissions available for payout" },
      { status: 400 }
    );
  }

  const totalAmount = approvedCommissions.reduce((sum, c) => sum + c.amount, 0);

  if (totalAmount < MIN_PAYOUT_USD) {
    return NextResponse.json(
      {
        error: `Minimum payout is $${MIN_PAYOUT_USD.toFixed(2)}. Your approved balance is $${totalAmount.toFixed(2)}.`,
      },
      { status: 400 }
    );
  }

  const commissionIds = approvedCommissions.map((c) => c.id);

  // Create the payout request in a transaction and then attempt external payment
  const payoutRequest = await prisma.payoutRequest.create({
    data: {
      affiliateId: affiliate.id,
      amount: totalAmount,
      method: method as "STRIPE" | "PAYPAL",
      status: "PROCESSING",
      commissions: {
        connect: commissionIds.map((id) => ({ id })),
      },
    },
  });

  // Mark commissions as PAID
  await prisma.commission.updateMany({
    where: { id: { in: commissionIds } },
    data: {
      status: "PAID",
      paidAt: new Date(),
      payoutRequestId: payoutRequest.id,
    },
  });

  try {
    if (method === "PAYPAL") {
      const result = await createPayPalPayout([
        {
          receiverEmail: affiliate.paypalEmail!,
          amount: totalAmount,
          currency: "USD",
          senderItemId: payoutRequest.id,
          note: `Artifacial affiliate commission payout — ${commissionIds.length} commission(s)`,
        },
      ]);

      await prisma.payoutRequest.update({
        where: { id: payoutRequest.id },
        data: {
          status: "COMPLETED",
          paypalBatchId: result.batchId,
          processedAt: new Date(),
        },
      });
    } else {
      // Stripe Connect transfer
      const transfer = await getStripe().transfers.create({
        amount: Math.round(totalAmount * 100), // cents
        currency: "usd",
        destination: affiliate.stripeAccountId!,
        description: `Artifacial affiliate payout — ${commissionIds.length} commission(s)`,
        metadata: {
          payoutRequestId: payoutRequest.id,
          affiliateId: affiliate.id,
        },
      });

      await prisma.payoutRequest.update({
        where: { id: payoutRequest.id },
        data: {
          status: "COMPLETED",
          stripeTransferId: transfer.id,
          processedAt: new Date(),
        },
      });
    }
  } catch (err) {
    // External payment failed — revert commission status so affiliate can retry
    await prisma.commission.updateMany({
      where: { id: { in: commissionIds } },
      data: {
        status: "APPROVED",
        paidAt: null,
        payoutRequestId: null,
      },
    });

    await prisma.payoutRequest.update({
      where: { id: payoutRequest.id },
      data: { status: "FAILED" },
    });

    const message = err instanceof Error ? err.message : "Unknown payment error";
    return NextResponse.json(
      { error: `Payout processing failed: ${message}` },
      { status: 502 }
    );
  }

  const finalPayoutRequest = await prisma.payoutRequest.findUnique({
    where: { id: payoutRequest.id },
    include: {
      commissions: {
        select: { id: true, amount: true, type: true, status: true },
      },
    },
  });

  return NextResponse.json({ payoutRequest: finalPayoutRequest });
}
