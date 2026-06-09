/**
 * GET /api/characters/community
 *
 * Public catalog of user-published characters. Anyone can browse; you don't
 * need to be authenticated to see the gallery (sign-in is required to clone).
 *
 * Pagination via cursor on (publishedAt desc, id desc). Page size 24.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSignedR2Url } from "@/lib/r2";

const PAGE_SIZE = 24;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const q = url.searchParams.get("q")?.trim().slice(0, 80) ?? "";

  // Build the where clause. Cursor format: "<publishedAtISO>|<id>"
  let cursorWhere: { OR: Array<Record<string, unknown>> } | undefined;
  if (cursor) {
    const [iso, id] = cursor.split("|");
    if (iso && id) {
      const d = new Date(iso);
      if (!isNaN(d.getTime())) {
        cursorWhere = {
          OR: [
            { publishedAt: { lt: d } },
            { publishedAt: d, id: { lt: id } },
          ],
        };
      }
    }
  }

  const rows = await prisma.character.findMany({
    where: {
      isPublic: true,
      publishedAt: { not: null },
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { description: { contains: q, mode: "insensitive" as const } },
              { style: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(cursorWhere ?? {}),
    },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    select: {
      id: true,
      name: true,
      style: true,
      description: true,
      sourceImage: true,
      faceImageUrl: true,
      referenceImages: true,
      publishedAt: true,
      cloneCount: true,
      user: { select: { name: true } },
    },
  });

  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  const characters = await Promise.all(
    page.map(async (c) => {
      const rawImage = c.faceImageUrl ?? c.sourceImage ?? c.referenceImages[0] ?? null;
      const imageUrl = rawImage
        ? rawImage.startsWith("http")
          ? rawImage
          : await getSignedR2Url(rawImage, 3600).catch(() => rawImage)
        : null;
      return {
        id: c.id,
        name: c.name,
        style: c.style,
        description: c.description,
        imageUrl,
        publishedAt: c.publishedAt?.toISOString() ?? null,
        cloneCount: c.cloneCount,
        creatorName: c.user?.name ?? "Anonymous",
      };
    }),
  );

  const last = page[page.length - 1];
  const nextCursor = hasMore && last?.publishedAt
    ? `${last.publishedAt.toISOString()}|${last.id}`
    : null;

  return NextResponse.json({ characters, nextCursor });
}
