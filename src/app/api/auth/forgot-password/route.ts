import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { getResend, sendPasswordResetEmail } from "@/lib/resend";

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const normalized = email.toLowerCase().trim();

  // Always return success to prevent email enumeration
  const user = await prisma.user.findUnique({
    where: { email: normalized },
    include: { accounts: { select: { provider: true } } },
  });
  if (!user) {
    return NextResponse.json({ ok: true });
  }
  if (!user.hashedPassword) {
    // Google-only account — send a different email explaining this
    const providers = user.accounts.map((a) => a.provider);
    if (providers.includes("google")) {
      console.log(`[forgot-password] Google-only account: ${normalized}`);
      // Send email telling them to use Google sign-in
      try {
        await getResend().emails.send({
          from: "Artifacial <noreply@artifacial.app>",
          to: normalized,
          subject: "Sign in to Artifacial",
          html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#0A0A0B;font-family:'DM Sans',Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0B;padding:48px 16px;"><tr><td align="center"><table width="480" cellpadding="0" cellspacing="0" style="background:#111113;border:1px solid #2a2a2e;border-radius:16px;padding:48px 40px;"><tr><td align="center" style="padding-bottom:32px;"><h1 style="margin:0;font-size:28px;font-weight:700;color:#E8A634;letter-spacing:-0.5px;">Artifacial</h1></td></tr><tr><td style="padding-bottom:16px;"><h2 style="margin:0;font-size:20px;font-weight:600;color:#f0f0f0;">Your account uses Google sign-in</h2></td></tr><tr><td style="padding-bottom:32px;"><p style="margin:0;font-size:15px;line-height:1.6;color:#999;">Your Artifacial account is linked to Google. You don't have a separate password — just click <strong style="color:#ccc;">Continue with Google</strong> on the sign-in page.</p></td></tr><tr><td align="center" style="padding-bottom:32px;"><a href="https://artifacial.app/sign-in" style="display:inline-block;background:#E8A634;color:#0A0A0B;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;">Go to Sign In</a></td></tr></table></td></tr></table></body></html>`,
        });
      } catch (e) {
        console.error("[forgot-password] Failed to send Google-account notice:", e);
      }
    }
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

  try {
    await sendPasswordResetEmail(normalized, resetUrl);
    console.log(`[forgot-password] Reset email sent to: ${normalized}`);
  } catch (e) {
    console.error("[forgot-password] Failed to send reset email:", e);
    // Still return ok — don't reveal internal errors
  }

  return NextResponse.json({ ok: true });
}
