import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Admin-only
  const caller = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!caller?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email, amount, pool = "purchased" } = await req.json();

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }
  if (!amount || typeof amount !== "number" || amount <= 0) {
    return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });
  }
  if (pool !== "subscription" && pool !== "purchased") {
    return NextResponse.json({ error: "Pool must be 'subscription' or 'purchased'" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, name: true, email: true, subscriptionCredits: true, purchasedCredits: true },
  });

  if (!user) {
    return NextResponse.json({ error: `No user found: ${email}` }, { status: 404 });
  }

  const field = pool === "subscription" ? "subscriptionCredits" : "purchasedCredits";
  const before = pool === "subscription" ? user.subscriptionCredits : user.purchasedCredits;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { [field]: { increment: amount } },
    select: { subscriptionCredits: true, purchasedCredits: true },
  });

  return NextResponse.json({
    user: user.name || user.email,
    email: user.email,
    pool,
    before,
    added: amount,
    after: before + amount,
    total: updated.subscriptionCredits + updated.purchasedCredits,
  });
}
