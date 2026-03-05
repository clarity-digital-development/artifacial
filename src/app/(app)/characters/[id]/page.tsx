import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { getCharacterWithSignedUrls } from "@/lib/characters";
import { CharacterDetailClient } from "./client";

export default async function CharacterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { id } = await params;
  const character = await getCharacterWithSignedUrls(id, session.user.id);

  if (!character) notFound();

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
    />
  );
}
