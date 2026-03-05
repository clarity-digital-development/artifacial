import { prisma } from "@/lib/db";
import { getSignedR2Url } from "@/lib/r2";

export interface CharacterWithUrls {
  id: string;
  name: string;
  description: string | null;
  style: string;
  sourceImage: string | null;
  referenceImages: string[];
  signedUrls: string[];
  createdAt: Date;
  updatedAt: Date;
}

export async function getCharacterWithSignedUrls(
  characterId: string,
  userId: string
): Promise<CharacterWithUrls | null> {
  const character = await prisma.character.findFirst({
    where: { id: characterId, userId },
  });

  if (!character) return null;

  const signedUrls = await Promise.all(
    character.referenceImages.map((key) => getSignedR2Url(key, 86400))
  );

  return { ...character, signedUrls };
}

export async function getCharactersWithSignedUrls(
  userId: string
): Promise<CharacterWithUrls[]> {
  const characters = await prisma.character.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return Promise.all(
    characters.map(async (c) => {
      const signedUrls =
        c.referenceImages.length > 0
          ? await Promise.all(
              c.referenceImages.slice(0, 1).map((key) =>
                getSignedR2Url(key, 86400)
              )
            )
          : [];
      return { ...c, signedUrls };
    })
  );
}
