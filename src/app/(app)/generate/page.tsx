import { auth } from "@/lib/auth";
// import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAvailableCredits } from "@/lib/credits";
import { getSignedR2Url } from "@/lib/r2";
import { GenerateClient } from "./generate-client";

export type CharacterOption = {
  id: string;
  name: string;
  style: string;
  thumbnailUrl: string | null;
  referenceImageKey: string | null;
};

export default async function GeneratePage() {
  const session = await auth();
  // TODO: re-enable auth redirect before shipping
  // if (!session?.user?.id) redirect("/sign-in");

  let totalCredits = 100;
  let tier = "STARTER";
  let contentMode = "SFW";
  let characters: CharacterOption[] = [];

  if (session?.user?.id) {
    const [credits, user] = await Promise.all([
      getAvailableCredits(session.user.id),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { subscriptionTier: true, contentMode: true },
      }),
    ]);

    totalCredits = credits.total;
    if (user) {
      tier = user.subscriptionTier;
      contentMode = user.contentMode;
    }

    // Fetch characters with thumbnails for I2V character picker
    const userCharacters = await prisma.character.findMany({
      where: { userId: session.user.id },
      select: { id: true, name: true, style: true, referenceImages: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    characters = await Promise.all(
      userCharacters.map(async (c) => {
        const firstKey = c.referenceImages[0] ?? null;
        let thumbnailUrl: string | null = null;
        if (firstKey) {
          try {
            thumbnailUrl = await getSignedR2Url(firstKey, 86400);
          } catch {
            // R2 may not be configured
          }
        }
        return {
          id: c.id,
          name: c.name,
          style: c.style,
          thumbnailUrl,
          referenceImageKey: firstKey,
        };
      })
    );
  }

  return (
    <GenerateClient
      totalCredits={totalCredits}
      tier={tier}
      characters={characters}
      contentMode={contentMode}
    />
  );
}
