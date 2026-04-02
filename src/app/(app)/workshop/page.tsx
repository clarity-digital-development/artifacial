import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { WorkshopClient } from "./workshop-client";

export const metadata = {
  title: "Workshop — Artifacial",
};

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

  return <WorkshopClient totalCredits={totalCredits} />;
}
