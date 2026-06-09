/**
 * POST /api/characters/community/[id]/clone
 *
 * Clone a public Character into the authenticated user's library. Copies
 * metadata + reuses the existing image URLs (no R2 storage cost). Bumps the
 * source character's cloneCount so popular ones surface higher.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const source = await prisma.character.findFirst({
    where: { id, isPublic: true },
    select: {
      id: true,
      userId: true,
      name: true,
      description: true,
      style: true,
      sourceImage: true,
      faceImageUrl: true,
      referenceImages: true,
      nsfwEligible: true,
      estimatedAgeLow: true,
      estimatedAgeHigh: true,
    },
  });
  if (!source) return NextResponse.json({ error: "Character not found or not public" }, { status: 404 });

  // Don't let a user clone their own character — it'd be a no-op.
  if (source.userId === session.user.id) {
    return NextResponse.json({ error: "This is already your character" }, { status: 400 });
  }

  const clone = await prisma.character.create({
    data: {
      userId: session.user.id,
      name: source.name,
      description: source.description,
      style: source.style,
      sourceImage: source.sourceImage,
      faceImageUrl: source.faceImageUrl,
      referenceImages: source.referenceImages,
      nsfwEligible: source.nsfwEligible,
      estimatedAgeLow: source.estimatedAgeLow,
      estimatedAgeHigh: source.estimatedAgeHigh,
      // Clones default to private — user can re-publish if they want.
      isPublic: false,
    },
    select: { id: true, name: true },
  });

  // Bump source cloneCount (best-effort, doesn't block the response)
  prisma.character
    .update({ where: { id: source.id }, data: { cloneCount: { increment: 1 } } })
    .catch(() => {});

  return NextResponse.json({ character: clone });
}
