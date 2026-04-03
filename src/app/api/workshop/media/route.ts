import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSignedR2Url } from "@/lib/r2";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ images: [], generatedImages: [] });
  }

  const userId = session.user.id;

  const characters = await prisma.character.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      faceImageUrl: true,
      referenceImages: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const images = await Promise.all(
    characters.map(async (c) => {
      // Prefer faceImageUrl (direct URL), fall back to first referenceImage (R2 key → signed)
      let url: string | null = c.faceImageUrl ?? null;
      if (!url && c.referenceImages.length > 0) {
        url = await getSignedR2Url(c.referenceImages[0], 86400);
      }
      return url ? { id: c.id, url, name: c.name } : null;
    })
  );

  return NextResponse.json({
    images: images.filter(Boolean),
    generatedImages: [],
  });
}
