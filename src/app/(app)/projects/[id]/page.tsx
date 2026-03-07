import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSignedR2Url } from "@/lib/r2";
import { SceneBuilderClient } from "./client";

export default async function SceneBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
    include: {
      character: {
        select: { id: true, name: true, referenceImages: true, style: true },
      },
    },
  });

  if (!project) notFound();

  // Get character thumbnail if exists
  let characterThumbnail: string | null = null;
  if (project.character?.referenceImages[0]) {
    try {
      characterThumbnail = await getSignedR2Url(
        project.character.referenceImages[0],
        86400
      );
    } catch {
      // R2 may not be configured yet
    }
  }

  // Get signed video URL if project is complete
  let videoUrl: string | null = null;
  if (project.finalVideoUrl) {
    try {
      videoUrl = await getSignedR2Url(project.finalVideoUrl, 86400);
    } catch {
      // R2 may not be configured yet
    }
  }

  // Get all user characters with thumbnails for the character selector
  const rawCharacters = await prisma.character.findMany({
    where: { userId: session.user.id },
    select: { id: true, name: true, style: true, referenceImages: true },
    orderBy: { createdAt: "desc" },
  });

  const characters = await Promise.all(
    rawCharacters.map(async (c) => {
      let thumbnail: string | null = null;
      if (c.referenceImages[0]) {
        try {
          thumbnail = await getSignedR2Url(c.referenceImages[0], 86400);
        } catch {
          // ignore
        }
      }
      return { id: c.id, name: c.name, style: c.style, thumbnail };
    })
  );

  // Fetch recent projects for history (last 20, excluding current)
  const recentProjects = await prisma.project.findMany({
    where: {
      userId: session.user.id,
      id: { not: id },
      status: { in: ["complete", "generating", "failed"] },
    },
    orderBy: { updatedAt: "desc" },
    take: 20,
    include: {
      character: { select: { name: true } },
    },
  });

  const history = await Promise.all(
    recentProjects.map(async (p) => {
      let thumbUrl: string | null = null;
      if (p.finalVideoUrl) {
        try {
          thumbUrl = await getSignedR2Url(p.finalVideoUrl, 86400);
        } catch {
          // ignore
        }
      }
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        mode: p.mode,
        prompt: p.prompt,
        duration: p.duration,
        aspectRatio: p.aspectRatio,
        characterName: p.character?.name ?? null,
        videoUrl: thumbUrl,
        createdAt: p.createdAt.toISOString(),
      };
    })
  );

  return (
    <SceneBuilderClient
      project={{
        id: project.id,
        name: project.name,
        mode: project.mode,
        status: project.status,
        characterId: project.characterId,
        characterName: project.character?.name ?? null,
        characterThumbnail,
        videoUrl,
        prompt: project.prompt,
        duration: project.duration,
        aspectRatio: project.aspectRatio,
      }}
      characters={characters}
      history={history}
    />
  );
}
