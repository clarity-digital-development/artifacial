import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { canUseResolution } from "@/lib/stripe";
import { GenerateClient } from "./generate-client";

export default async function GeneratePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const [user, characters] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        subscriptionTier: true,
        subscriptionCredits: true,
        purchasedCredits: true,
        contentMode: true,
      },
    }),
    prisma.character.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        referenceImages: true,
        faceImageUrl: true,
      },
    }),
  ]);

  const tier = user?.subscriptionTier ?? "FREE";
  const totalCredits =
    (user?.subscriptionCredits ?? 0) + (user?.purchasedCredits ?? 0);

  return (
    <GenerateClient
      characters={characters}
      totalCredits={totalCredits}
      tier={tier}
      canUse1080p={canUseResolution(tier, "1080p")}
      canUse1440p={canUseResolution(tier, "1440p")}
    />
  );
}
