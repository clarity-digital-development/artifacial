import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { WorkshopClient } from "../../workshop/workshop-client";

export const metadata = {
  title: "Admin — Workshop — Artifacial",
};

export default async function AdminWorkshopPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { subscriptionCredits: true, purchasedCredits: true, isAdmin: true },
  });

  if (!user?.isAdmin) redirect("/workshop");

  const totalCredits = (user.subscriptionCredits ?? 0) + (user.purchasedCredits ?? 0);

  // Pass all tools (no filter) — admin sees everything
  return <WorkshopClient totalCredits={totalCredits} />;
}
