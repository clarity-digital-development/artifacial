import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { MarketingClient } from "./marketing-client";

export const metadata = {
  title: "Marketing Studio — Artifacial",
};

export default async function MarketingPage() {
  const session = await auth();
  let totalCredits = 0;

  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { subscriptionCredits: true, purchasedCredits: true },
    });
    if (user) totalCredits = (user.subscriptionCredits ?? 0) + (user.purchasedCredits ?? 0);
  }

  return <MarketingClient totalCredits={totalCredits} />;
}
