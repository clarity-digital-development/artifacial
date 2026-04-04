import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

interface ApplyRequestBody {
  name: string;
  email: string;
  agentCode: string;
  notes?: string;
}

/**
 * POST /api/agency/apply
 *
 * Public endpoint — no auth required.
 * Content creators who clicked an agent's referral link submit this to register
 * their interest in joining the Rewardful affiliate program. When Rewardful
 * fires `affiliate.created` with the same email, we'll link them to this agent.
 */
export async function POST(req: Request): Promise<NextResponse> {
  let body: ApplyRequestBody;

  try {
    body = (await req.json()) as ApplyRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, email, agentCode, notes } = body;

  // ── Validation ──
  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  if (!agentCode || typeof agentCode !== "string" || agentCode.trim().length === 0) {
    return NextResponse.json({ error: "agentCode is required" }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedCode = agentCode.toUpperCase().trim();

  // ── Verify the agent exists and is active ──
  const agentAffiliate = await prisma.affiliate.findUnique({
    where: { code: normalizedCode },
    select: { id: true, tier: true, status: true },
  });

  if (!agentAffiliate) {
    return NextResponse.json({ error: "Invalid agent code" }, { status: 404 });
  }

  if (agentAffiliate.tier !== "AGENT") {
    return NextResponse.json({ error: "Invalid agent code" }, { status: 404 });
  }

  if (agentAffiliate.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "This agent is not currently accepting applications" },
      { status: 403 }
    );
  }

  // ── Idempotency: prevent duplicate applications from the same email ──
  const existingApplication = await prisma.agentApplication.findFirst({
    where: { email: normalizedEmail, agentCode: normalizedCode, status: "PENDING" },
  });

  if (existingApplication) {
    // Silently succeed — don't expose whether an application already exists
    return NextResponse.json({
      success: true,
      message: "Application received. We'll be in touch soon.",
    });
  }

  // ── Create the application ──
  await prisma.agentApplication.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      agentCode: normalizedCode,
      notes: notes?.trim() || null,
      status: "PENDING",
    },
  });

  return NextResponse.json({
    success: true,
    message: "Application received. We'll be in touch soon.",
  });
}
