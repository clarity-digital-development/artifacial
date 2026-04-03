import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/resend";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const normalized = email.toLowerCase().trim();

  // Always return success to prevent email enumeration
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user || !user.hashedPassword) {
    // Either no account, or Google-only account — return success silently
    return NextResponse.json({ ok: true });
  }

  // Delete any existing tokens for this email
  await prisma.passwordResetToken.deleteMany({ where: { email: normalized } });

  // Generate a secure token (32 bytes = 64 hex chars)
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.passwordResetToken.create({
    data: { email: normalized, token, expires },
  });

  const appUrl = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "https://artifacial.app";
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  await sendPasswordResetEmail(normalized, resetUrl);

  return NextResponse.json({ ok: true });
}
