import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getCharacterWithSignedUrls } from "@/lib/characters";
import { prisma } from "@/lib/db";
import { getSignedR2Url } from "@/lib/r2";
import { CharacterDetailClient } from "./client";

export default async function CharacterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  // TODO: re-enable auth redirect before shipping
  // if (!session?.user?.id) redirect("/sign-in");
  const userId = session?.user?.id;

  const { id } = await params;
  const character = userId ? await getCharacterWithSignedUrls(id, userId) : null;

  if (!character) notFound();

  // Last 12 generations that used this character — surfaces a per-character
  // gallery so users can see what they've already created with them.
  const rawGens = userId
    ? await prisma.generation.findMany({
        where: { userId, characterId: id, status: "COMPLETED", outputUrl: { not: null } },
        orderBy: { completedAt: "desc" },
        take: 12,
        select: {
          id: true,
          workflowType: true,
          modelId: true,
          outputUrl: true,
          thumbnailUrl: true,
          completedAt: true,
        },
      })
    : [];

  // Sign R2 keys for display
  const generations = await Promise.all(
    rawGens.map(async (g) => ({
      id: g.id,
      workflowType: g.workflowType,
      modelId: g.modelId,
      outputUrl: g.outputUrl ? (g.outputUrl.startsWith("http") ? g.outputUrl : await getSignedR2Url(g.outputUrl, 3600).catch(() => g.outputUrl!)) : null,
      thumbnailUrl: g.thumbnailUrl ? (g.thumbnailUrl.startsWith("http") ? g.thumbnailUrl : await getSignedR2Url(g.thumbnailUrl, 3600).catch(() => g.thumbnailUrl!)) : null,
      completedAt: g.completedAt?.toISOString() ?? null,
    })),
  );

  return (
    <CharacterDetailClient
      character={{
        id: character.id,
        name: character.name,
        description: character.description,
        style: character.style,
        signedUrls: character.signedUrls,
        createdAt: character.createdAt.toISOString(),
      }}
      recentGenerations={generations}
    />
  );
}
