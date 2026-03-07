import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

// TEMPORARY — remove after setting admin passwords
export async function POST(req: NextRequest) {
  try {
    const { email, password, secret } = await req.json();

    // Simple secret to prevent random calls
    if (secret !== process.env.ADMIN_RESET_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.update({
      where: { email },
      data: { hashedPassword, isAdmin: true },
    });

    return NextResponse.json({ success: true, userId: user.id });
  } catch (err) {
    console.error("[admin/reset-password] Error:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
