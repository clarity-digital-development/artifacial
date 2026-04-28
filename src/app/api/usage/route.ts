import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getModelById } from "@/lib/models/registry";

// Provider names that must never be exposed in user-facing strings.
// Matches common spellings/casings, with optional surrounding whitespace.
const PROVIDER_RE = /\b(KIE\.AI|KIEAI|KIE|PiAPI|PIAPI|Venice|fal\.ai|fal-ai)\s*/gi;

/**
 * Strip provider names and replace raw model IDs in parens with their
 * registry-friendly display names. Idempotent — safe to run on already-clean text.
 */
function sanitizeDescription(desc: string | null | undefined): string {
  if (!desc) return "";
  let out = desc.replace(PROVIDER_RE, "");

  // (model-id) → (Friendly Name) when registry knows the id
  out = out.replace(/\(([a-z0-9-]+)\)/g, (full, id: string) => {
    const model = getModelById(id);
    return model ? `(${model.name})` : full;
  });

  // Collapse whitespace from removals + re-capitalize after common prefixes
  out = out.replace(/\s+/g, " ").trim();
  out = out.replace(/^Refund:\s+([a-z])/, (_, c: string) => `Refund: ${c.toUpperCase()}`);
  out = out.replace(/^([a-z])/, (_, c: string) => c.toUpperCase());
  return out;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { subscriptionTier: true, subscriptionCredits: true, purchasedCredits: true },
  });

  const transactions = await prisma.creditTransaction.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Scrub provider names from descriptions and humanize model IDs
  const sanitized = transactions.map((t) => ({
    ...t,
    description: sanitizeDescription(t.description),
  }));

  return NextResponse.json({
    tier: user?.subscriptionTier ?? "FREE",
    subscriptionCredits: user?.subscriptionCredits ?? 0,
    purchasedCredits: user?.purchasedCredits ?? 0,
    totalCredits: (user?.subscriptionCredits ?? 0) + (user?.purchasedCredits ?? 0),
    transactions: sanitized,
  });
}
