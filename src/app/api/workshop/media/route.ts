import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ videos: [], images: [] });
  }

  const userId = session.user.id;

  const [generations, characters] = await Promise.all([
    prisma.generation.findMany({
      where: {
        userId,
        status: "COMPLETED",
        outputUrl: { not: null },
        workflowType: { in: ["IMAGE_TO_VIDEO", "TEXT_TO_VIDEO"] as const },
      },
      select: {
        id: true,
        outputUrl: true,
        thumbnailUrl: true,
        workflowType: true,
      },
      orderBy: { completedAt: "desc" },
      take: 30,
    }),
    prisma.character.findMany({
      where: {
        userId,
        faceImageUrl: { not: null },
      },
      select: {
        id: true,
        name: true,
        faceImageUrl: true,
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  return NextResponse.json({
    videos: generations.map((g) => ({
      id: g.id,
      url: g.outputUrl!,
      thumbnailUrl: g.thumbnailUrl ?? null,
    })),
    images: characters.map((c) => ({
      id: c.id,
      url: c.faceImageUrl!,
      name: c.name,
    })),
  });
}
