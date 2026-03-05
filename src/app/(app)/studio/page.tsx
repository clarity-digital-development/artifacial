import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCharactersWithSignedUrls } from "@/lib/characters";
import { QuickCreateBar } from "@/components/studio/quick-create-bar";
import { CharacterReel } from "@/components/studio/character-reel";
import { ProjectStrip } from "@/components/studio/project-strip";
import { StudioOnboarding } from "@/components/studio/onboarding";

export default async function StudioPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const [characters, projects] = await Promise.all([
    getCharactersWithSignedUrls(session.user.id),
    prisma.project.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        character: { select: { name: true } },
      },
    }),
  ]);

  const isFirstVisit = characters.length === 0 && projects.length === 0;

  if (isFirstVisit) {
    return <StudioOnboarding />;
  }

  const characterCards = characters.slice(0, 10).map((c) => ({
    id: c.id,
    name: c.name,
    style: c.style,
    thumbnailUrl: c.signedUrls[0] ?? null,
  }));

  const projectCards = projects.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    characterName: p.character?.name ?? null,
    updatedAt: p.updatedAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-10">
      <QuickCreateBar />
      {characters.length > 0 && <CharacterReel characters={characterCards} />}
      {projects.length > 0 && <ProjectStrip projects={projectCards} />}
    </div>
  );
}
