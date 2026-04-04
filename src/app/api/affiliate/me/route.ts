import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calculateAffiliateStats } from "@/lib/affiliate";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const affiliate = await prisma.affiliate.findUnique({
    where: { userId: session.user.id },
    include: {
      payoutRequests: {
        orderBy: { requestedAt: "desc" },
        take: 5,
        select: {
          id: true,
          amount: true,
          method: true,
          status: true,
          requestedAt: true,
          processedAt: true,
        },
      },
    },
  });

  if (!affiliate) {
    return NextResponse.json({ error: "No affiliate account found" }, { status: 404 });
  }

  const stats = await calculateAffiliateStats(affiliate.id);

  return NextResponse.json({ affiliate, stats });
}
