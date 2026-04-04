import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { CommissionStatus } from "@/generated/prisma/client";

const PAGE_SIZE = 20;

const VALID_STATUSES = new Set<string>(["PENDING", "APPROVED", "PAID", "CLAWED_BACK"]);

export async function GET(req: NextRequest) {
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

  const { searchParams } = req.nextUrl;

  const pageParam = searchParams.get("page");
  const page = pageParam && /^\d+$/.test(pageParam) ? Math.max(1, parseInt(pageParam, 10)) : 1;

  const statusParam = searchParams.get("status");
  const statusFilter =
    statusParam && VALID_STATUSES.has(statusParam.toUpperCase())
      ? (statusParam.toUpperCase() as CommissionStatus)
      : undefined;

  const where = {
    affiliateId: affiliate.id,
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const [total, commissions] = await Promise.all([
    prisma.commission.count({ where }),
    prisma.commission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        type: true,
        sourceAffiliateId: true,
        referredUserId: true,
        stripeInvoiceId: true,
        stripeSubscriptionId: true,
        subscriptionRevenue: true,
        amount: true,
        currency: true,
        monthNumber: true,
        status: true,
        paysOutAt: true,
        paidAt: true,
        createdAt: true,
      },
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return NextResponse.json({
    commissions,
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  });
}
