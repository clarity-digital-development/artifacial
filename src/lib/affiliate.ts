import { prisma } from "@/lib/db";
import type { Affiliate, CommissionStatus } from "@/generated/prisma/client";

// ─── Lookups ───

export async function getAffiliateByCode(code: string): Promise<Affiliate | null> {
  return prisma.affiliate.findFirst({
    where: {
      code: code.toUpperCase(),
      status: "ACTIVE",
    },
  });
}

export async function getAffiliateByUserId(userId: string): Promise<Affiliate | null> {
  return prisma.affiliate.findUnique({
    where: { userId },
    include: {
      commissions: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      payoutRequests: {
        orderBy: { requestedAt: "desc" },
        take: 5,
      },
    },
  });
}

// ─── Stats ───

export interface AffiliateStats {
  totalClicks: number;
  totalConversions: number;
  activeReferrals: number;
  pendingEarnings: number;
  approvedEarnings: number;
  paidEarnings: number;
  totalEarnings: number;
}

export async function calculateAffiliateStats(affiliateId: string): Promise<AffiliateStats> {
  const [clickStats, conversionStats, commissionStats, activeReferrals] = await Promise.all([
    // Total clicks
    prisma.affiliateClick.count({
      where: { affiliateId },
    }),

    // Total conversions (clicks that led to a signup)
    prisma.affiliateClick.count({
      where: {
        affiliateId,
        convertedToUserId: { not: null },
      },
    }),

    // Commission totals by status
    prisma.commission.groupBy({
      by: ["status"],
      where: { affiliateId },
      _sum: { amount: true },
    }),

    // Active referrals = users referred by this affiliate who have a paid subscription
    prisma.user.count({
      where: {
        referredByAffiliateId: affiliateId,
        subscriptionTier: { notIn: ["FREE"] },
      },
    }),
  ]);

  const earningsByStatus: Record<string, number> = {};
  for (const row of commissionStats) {
    earningsByStatus[row.status] = row._sum.amount ?? 0;
  }

  const pendingEarnings = earningsByStatus["PENDING"] ?? 0;
  const approvedEarnings = earningsByStatus["APPROVED"] ?? 0;
  const paidEarnings = earningsByStatus["PAID"] ?? 0;

  return {
    totalClicks: clickStats,
    totalConversions: conversionStats,
    activeReferrals,
    pendingEarnings,
    approvedEarnings,
    paidEarnings,
    totalEarnings: pendingEarnings + approvedEarnings + paidEarnings,
  };
}

// ─── Approve Eligible Commissions (NET-30 cron) ───

/**
 * Finds all PENDING commissions whose NET-30 hold has expired and
 * flips them to APPROVED. Designed to be called from a cron route
 * or an on-demand admin endpoint.
 *
 * Returns the number of commissions updated.
 */
export async function markCommissionsApproved(): Promise<number> {
  const now = new Date();

  const result = await prisma.commission.updateMany({
    where: {
      status: "PENDING" as CommissionStatus,
      paysOutAt: { lte: now },
    },
    data: {
      status: "APPROVED" as CommissionStatus,
    },
  });

  return result.count;
}
