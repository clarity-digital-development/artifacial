import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST() {
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
    select: { id: true, tier: true, status: true, code: true },
  });

  const isAdmin = sessionUser?.isAdmin ?? false;

  if (!agentAffiliate && !isAdmin) {
    return NextResponse.json({ error: "No affiliate account found" }, { status: 404 });
  }

  if (!isAdmin && agentAffiliate?.tier !== "AGENT") {
    return NextResponse.json(
      { error: "Only agents can generate affiliate invite links" },
      { status: 403 }
    );
  }

  if (!isAdmin && agentAffiliate?.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Your agent account must be active to generate invite links" },
      { status: 403 }
    );
  }

  // Admins without an affiliate record get a generic invite link
  if (isAdmin && !agentAffiliate) {
    const appUrl = process.env.APP_URL ?? "https://artifacial.app";
    return NextResponse.json({ inviteUrl: `${appUrl}/apply` });
  }

  const appUrl = process.env.APP_URL ?? "https://artifacial.app";

  // The agent's own promo code serves as the invite token.
  // Any affiliate who applies via /join/[code] will be linked to this agent
  // as their parentAffiliateId.
  const inviteUrl = `${appUrl}/join/${agentAffiliate!.code}`;

  return NextResponse.json({ inviteUrl });
}
