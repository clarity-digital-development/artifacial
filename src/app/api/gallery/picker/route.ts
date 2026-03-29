import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSignedR2Url } from "@/lib/r2";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const generations = await prisma.generation.findMany({
    where: {
      userId: session.user.id,
      status: "COMPLETED",
      outputUrl: { not: null },
    },
    orderBy: { completedAt: "desc" },
    take: 50,
    select: {
      id: true,
      outputUrl: true,
      thumbnailUrl: true,
      inputParams: true,
    },
  });

  const items = await Promise.all(
    generations.map(async (g) => {
      let signedThumbnail: string | null = null;
      try {
        if (g.thumbnailUrl) {
          signedThumbnail = g.thumbnailUrl.startsWith("http")
            ? g.thumbnailUrl
            : await getSignedR2Url(g.thumbnailUrl, 3600);
        } else if (g.outputUrl) {
          // No thumbnail — sign the output URL for preview
          const url = g.outputUrl.startsWith("http")
            ? g.outputUrl
            : await getSignedR2Url(g.outputUrl, 3600);
          signedThumbnail = url;
        }
      } catch {
        // R2 may not be configured in dev
      }

      const params = g.inputParams as Record<string, unknown> | null;
      const prompt = (params?.prompt as string) ?? null;

      return {
        id: g.id,
        // Raw R2 key for submission (router will sign it with r2: prefix)
        outputKey: g.outputUrl,
        signedThumbnail,
        prompt,
      };
    })
  );

  // Filter out items with no usable thumbnail
  return NextResponse.json({ items: items.filter((i) => i.outputKey) });
}
