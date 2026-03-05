import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true, subscriptionCredits: true, purchasedCredits: true },
  });

  const transactions = await prisma.creditTransaction.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    plan: user?.plan ?? "free",
    subscriptionCredits: user?.subscriptionCredits ?? 0,
    purchasedCredits: user?.purchasedCredits ?? 0,
    totalCredits: (user?.subscriptionCredits ?? 0) + (user?.purchasedCredits ?? 0),
    transactions,
  });
}
