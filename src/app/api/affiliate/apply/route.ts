import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Alphanumeric only, 3–20 chars
const CODE_REGEX = /^[A-Z0-9]{3,20}$/;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    code?: string;
    platformUrl?: string;
    audienceSize?: string;
    contentNiche?: string;
    applicationNote?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { code, platformUrl, audienceSize, contentNiche, applicationNote } = body;

  // Validate code
  if (!code || typeof code !== "string") {
    return NextResponse.json({ error: "Promo code is required" }, { status: 400 });
  }

  const normalizedCode = code.trim().toUpperCase();

  if (!CODE_REGEX.test(normalizedCode)) {
    return NextResponse.json(
      { error: "Promo code must be 3–20 alphanumeric characters (letters and numbers only)" },
      { status: 400 }
    );
  }

  // Check user doesn't already have an affiliate record
  const existing = await prisma.affiliate.findUnique({
    where: { userId: session.user.id },
  });

  if (existing) {
    return NextResponse.json(
      { error: "You already have an affiliate account" },
      { status: 409 }
    );
  }

  // Check code uniqueness
  const codeConflict = await prisma.affiliate.findUnique({
    where: { code: normalizedCode },
  });

  if (codeConflict) {
    return NextResponse.json(
      { error: "That promo code is already taken. Please choose another." },
      { status: 409 }
    );
  }

  // Create affiliate application
  const affiliate = await prisma.affiliate.create({
    data: {
      userId: session.user.id,
      code: normalizedCode,
      tier: "AFFILIATE",
      status: "PENDING",
      platformUrl: platformUrl ?? null,
      audienceSize: audienceSize ?? null,
      contentNiche: contentNiche ?? null,
      applicationNote: applicationNote ?? null,
    },
  });

  return NextResponse.json({ affiliate }, { status: 201 });
}
