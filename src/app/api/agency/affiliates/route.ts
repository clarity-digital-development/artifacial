import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calculateAffiliateStats } from "@/lib/affiliate";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });

  const agentAffiliate = await prisma.affiliate.findUnique({
    where: { userId: session.user.id },
    select: { id: true, tier: true },
  });

  const isAdmin = sessionUser?.isAdmin ?? false;

  if (!agentAffiliate && !isAdmin) {
    return NextResponse.json({ error: "No affiliate account found" }, { status: 404 });
  }

  if (!isAdmin && agentAffiliate?.tier !== "AGENT") {
    return NextResponse.json(
      { error: "Only agents can view sub-affiliates" },
      { status: 403 }
    );
  }

  // Fetch all sub-affiliates of this agent (or all affiliates for admin preview)
  const subAffiliates = await prisma.affiliate.findMany({
    where: agentAffiliate ? { parentAffiliateId: agentAffiliate.id } : { parentAffiliateId: null },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Build enriched response: sub-affiliate stats + agent's override earnings from each
  const results = await Promise.all(
    subAffiliates.map(async (sub) => {
      const subStats = await calculateAffiliateStats(sub.id);

      // Agent's override commissions sourced from this sub-affiliate
      const overrideEarnings = agentAffiliate
        ? await prisma.commission.aggregate({
            where: {
              affiliateId: agentAffiliate.id,
              type: "OVERRIDE",
              sourceAffiliateId: sub.id,
            },
            _sum: { amount: true },
          })
        : { _sum: { amount: 0 } };

      return {
        id: sub.id,
        code: sub.code,
        tier: sub.tier,
        status: sub.status,
        createdAt: sub.createdAt,
        user: sub.user,
        stats: {
          totalClicks: subStats.totalClicks,
          totalConversions: subStats.totalConversions,
          activeReferrals: subStats.activeReferrals,
          pendingEarnings: subStats.pendingEarnings,
          approvedEarnings: subStats.approvedEarnings,
          paidEarnings: subStats.paidEarnings,
          totalEarnings: subStats.totalEarnings,
        },
        agentOverrideEarnings: overrideEarnings._sum.amount ?? 0,
      };
    })
  );

  return NextResponse.json({ subAffiliates: results, total: results.length });
}
