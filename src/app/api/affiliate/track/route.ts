import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import crypto from "crypto";

const COOKIE_NAME = "aff_code";
const COOKIE_MAX_AGE = 60 * 24 * 60 * 60; // 60 days in seconds

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const code = searchParams.get("code");
  const to = searchParams.get("to") ?? "/";

  // Validate redirect target — only allow relative paths or same-origin absolute URLs
  const safeTo = to.startsWith("/") ? to : "/";

  if (!code) {
    return NextResponse.redirect(new URL(safeTo, req.url));
  }

  const normalizedCode = code.trim().toUpperCase();

  const affiliate = await prisma.affiliate.findFirst({
    where: {
      code: normalizedCode,
      status: "ACTIVE",
    },
    select: { id: true, code: true },
  });

  if (!affiliate) {
    // Unknown or inactive code — still redirect, just don't track
    return NextResponse.redirect(new URL(safeTo, req.url));
  }

  // Hash IP for privacy (GDPR-friendly)
  const rawIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const ipHash = crypto.createHash("sha256").update(rawIp).digest("hex");

  const userAgent = req.headers.get("user-agent") ?? undefined;

  // Record the click (fire-and-forget style but we await to keep request clean)
  await prisma.affiliateClick.create({
    data: {
      affiliateId: affiliate.id,
      ipHash,
      userAgent: userAgent ?? null,
      landingPage: safeTo,
    },
  });

  const response = NextResponse.redirect(new URL(safeTo, req.url));

  // Set affiliate tracking cookie
  response.cookies.set(COOKIE_NAME, normalizedCode, {
    maxAge: COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return response;
}
