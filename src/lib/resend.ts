import { Resend } from "resend";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  await getResend().emails.send({
    from: "Artifacial <noreply@artifacial.app>",
    to: email,
    subject: "Reset your Artifacial password",
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0A0A0B;font-family:'DM Sans',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0B;padding:48px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#111113;border:1px solid #2a2a2e;border-radius:16px;padding:48px 40px;">
        <tr><td align="center" style="padding-bottom:32px;">
          <h1 style="margin:0;font-size:28px;font-weight:700;color:#E8A634;letter-spacing:-0.5px;">Artifacial</h1>
        </td></tr>
        <tr><td style="padding-bottom:16px;">
          <h2 style="margin:0;font-size:20px;font-weight:600;color:#f0f0f0;">Reset your password</h2>
        </td></tr>
        <tr><td style="padding-bottom:32px;">
          <p style="margin:0;font-size:15px;line-height:1.6;color:#999;">
            We received a request to reset the password for your Artifacial account. Click the button below to choose a new password. This link expires in <strong style="color:#ccc;">1 hour</strong>.
          </p>
        </td></tr>
        <tr><td align="center" style="padding-bottom:32px;">
          <a href="${resetUrl}" style="display:inline-block;background:#E8A634;color:#0A0A0B;font-size:15px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:10px;">
            Reset Password
          </a>
        </td></tr>
        <tr><td style="padding-bottom:16px;border-top:1px solid #2a2a2e;padding-top:24px;">
          <p style="margin:0;font-size:12px;color:#666;line-height:1.6;">
            If you didn't request this, you can safely ignore this email. Your password won't change.<br><br>
            Or copy this link into your browser:<br>
            <span style="color:#E8A634;word-break:break-all;">${resetUrl}</span>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
    `.trim(),
  });
}
