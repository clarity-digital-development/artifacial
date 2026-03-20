import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { confirmation } = await req.json();

  if (confirmation !== "DELETE") {
    return NextResponse.json(
      { error: "Type DELETE to confirm account deletion" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeSubscriptionId: true },
  });

  // Cancel Stripe subscription if active
  if (user?.stripeSubscriptionId) {
    try {
      const { getStripe } = await import("@/lib/stripe");
      const stripe = getStripe();
      await stripe.subscriptions.cancel(user.stripeSubscriptionId);
    } catch (err) {
      console.error("[account-delete] Failed to cancel Stripe subscription:", err);
    }
  }

  // Cancel all QUEUED generation jobs (PROCESSING jobs will complete naturally)
  // No credit refund needed — credits get zeroed in the soft-delete anyway
  await prisma.generation.updateMany({
    where: {
      userId: session.user.id,
      status: "QUEUED",
    },
    data: {
      status: "FAILED",
      errorMessage: "Account deleted",
      completedAt: new Date(),
    },
  });

  // Mark PROCESSING jobs so the worker knows to skip failure refunds
  // (credits are zeroed, refunding would fail or create negative balance)
  await prisma.generation.updateMany({
    where: {
      userId: session.user.id,
      status: "PROCESSING",
    },
    data: {
      errorMessage: "ACCOUNT_DELETED",
    },
  });

  // Soft-delete: set deletedAt, clear PII, revoke sessions
  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.user.id },
      data: {
        deletedAt: new Date(),
        name: "[deleted]",
        email: null,
        image: null,
        contentMode: "SFW",
        subscriptionCredits: 0,
        purchasedCredits: 0,
      },
    }),
    prisma.session.deleteMany({
      where: { userId: session.user.id },
    }),
  ]);

  return NextResponse.json({ deleted: true });
}
