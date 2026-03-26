import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCharactersWithSignedUrls } from "@/lib/characters";
import { getSignedR2Url } from "@/lib/r2";
import { QuickCreateBar } from "@/components/studio/quick-create-bar";
import { CharacterReel } from "@/components/studio/character-reel";
import { RecentGenerations } from "@/components/studio/recent-generations";
import { StudioOnboarding } from "@/components/studio/onboarding";

export default async function StudioPage() {
  const session = await auth();
  // TODO: re-enable auth redirect before shipping
  // if (!session?.user?.id) redirect("/sign-in");
  const userId = session?.user?.id;

  const [characters, generations] = await Promise.all([
    userId ? getCharactersWithSignedUrls(userId) : Promise.resolve([]),
    userId ? prisma.generation.findMany({
      where: { userId },
      orderBy: { queuedAt: "desc" },
      take: 12,
      select: {
        id: true,
        status: true,
        modelId: true,
        workflowType: true,
        durationSec: true,
        withAudio: true,
        outputUrl: true,
        progress: true,
        queuedAt: true,
        completedAt: true,
        inputParams: true,
      },
    }) : Promise.resolve([]),
  ]);

  const isFirstVisit = characters.length === 0 && generations.length === 0;

  if (isFirstVisit) {
    return <StudioOnboarding />;
  }

  const characterCards = characters.slice(0, 10).map((c) => ({
    id: c.id,
    name: c.name,
    style: c.style,
    thumbnailUrl: c.signedUrls[0] ?? null,
  }));

  // Sign R2 URLs for completed generations
  const generationCards = await Promise.all(
    generations.map(async (g) => {
      let videoUrl: string | null = null;
      if (g.status === "COMPLETED" && g.outputUrl) {
        try {
          videoUrl = g.outputUrl.startsWith("http")
            ? g.outputUrl
            : await getSignedR2Url(g.outputUrl, 3600);
        } catch {
          // R2 may not be configured
        }
      }

      const params = g.inputParams as Record<string, unknown> | null;
      const prompt = (params?.prompt as string) ?? "";

      return {
        id: g.id,
        status: g.status,
        modelId: g.modelId ?? "unknown",
        workflowType: g.workflowType,
        durationSec: g.durationSec ?? 5,
        withAudio: g.withAudio,
        videoUrl,
        progress: g.progress,
        prompt,
        completedAt: g.completedAt?.toISOString() ?? g.queuedAt.toISOString(),
      };
    })
  );

  return (
    <div className="flex flex-col gap-6 md:gap-12">
      <div className="hidden md:block">
        <QuickCreateBar />
      </div>
      {characters.length > 0 && <CharacterReel characters={characterCards} />}
      {generationCards.length > 0 && <RecentGenerations generations={generationCards} />}
    </div>
  );
}
