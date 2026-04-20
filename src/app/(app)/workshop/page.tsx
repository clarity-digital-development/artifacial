import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { WorkshopClient } from "./workshop-client";
import { WORKSHOP_TOOLS } from "@/lib/workshop/tools";

export const metadata = {
  title: "Workshop — Artifacial",
};

// Slugs visible to all users on the public workshop page
const PUBLIC_TOOL_SLUGS = [
  "character-swap",
  "recraft-crisp-upscale",
  // ── New Apr 2026 ──
  "auto-captions",
  "auto-clip",
  "auto-reframe",
  "voice-clone",
  "talking-avatar",
];

export default async function WorkshopPage() {
  const session = await auth();
  let totalCredits = 0;

  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { subscriptionCredits: true, purchasedCredits: true },
    });
    if (user) {
      totalCredits = (user.subscriptionCredits ?? 0) + (user.purchasedCredits ?? 0);
    }
  }

  const visibleTools = WORKSHOP_TOOLS.filter((t) => PUBLIC_TOOL_SLUGS.includes(t.slug));

  return <WorkshopClient totalCredits={totalCredits} tools={visibleTools} />;
}
