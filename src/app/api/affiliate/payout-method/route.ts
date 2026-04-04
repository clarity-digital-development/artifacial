import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const affiliate = await prisma.affiliate.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!affiliate) {
    return NextResponse.json({ error: "No affiliate account found" }, { status: 404 });
  }

  let body: { method?: string; paypalEmail?: string; stripeAccountId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { method, paypalEmail, stripeAccountId } = body;

  if (!method || !["STRIPE", "PAYPAL"].includes(method)) {
    return NextResponse.json(
      { error: "method must be STRIPE or PAYPAL" },
      { status: 400 }
    );
  }

  if (method === "PAYPAL") {
    if (!paypalEmail || typeof paypalEmail !== "string" || !paypalEmail.includes("@")) {
      return NextResponse.json(
        { error: "A valid paypalEmail is required for PayPal payouts" },
        { status: 400 }
      );
    }

    await prisma.affiliate.update({
      where: { id: affiliate.id },
      data: {
        payoutMethod: "PAYPAL",
        paypalEmail: paypalEmail.trim().toLowerCase(),
        // Clear Stripe account when switching to PayPal
        stripeAccountId: null,
      },
    });
  } else {
    // STRIPE
    if (!stripeAccountId || typeof stripeAccountId !== "string") {
      return NextResponse.json(
        { error: "stripeAccountId is required for Stripe payouts" },
        { status: 400 }
      );
    }

    await prisma.affiliate.update({
      where: { id: affiliate.id },
      data: {
        payoutMethod: "STRIPE",
        stripeAccountId: stripeAccountId.trim(),
        // Clear PayPal when switching to Stripe
        paypalEmail: null,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
