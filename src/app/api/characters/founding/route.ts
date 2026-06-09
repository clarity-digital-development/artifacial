/**
 * Founding character library — public catalog + clone-to-library action.
 *
 * GET   → list all founding characters (slug, name, persona, imageUrl, description)
 * POST  → clone a founding character into the authenticated user's library.
 *         Body: { slug: string, name?: string } — optional name override.
 *         Returns the new Character row id so the client can navigate to it.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  FOUNDING_CHARACTERS,
  getFoundingCharacter,
  foundingImageUrl,
} from "@/lib/characters/founding-pool";

export const runtime = "nodejs";

export async function GET() {
  const list = FOUNDING_CHARACTERS.map((c) => ({
    slug: c.slug,
    name: c.name,
    persona: c.persona,
    description: c.description,
    style: c.style,
    imageUrl: foundingImageUrl(c.slug),
  }));
  return NextResponse.json({ characters: list });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { slug?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const template = getFoundingCharacter(slug);
  if (!template) return NextResponse.json({ error: `Unknown founding character: ${slug}` }, { status: 404 });

  // Best origin guess — use APP_URL when available; otherwise rely on the request host so the
  // image is reachable in both prod + dev.
  const appUrl = (process.env.APP_URL ?? "").trim();
  const origin = appUrl || req.nextUrl.origin;
  const absoluteImageUrl = `${origin}${foundingImageUrl(template.slug)}`;

  const overrideName = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";

  const character = await prisma.character.create({
    data: {
      userId: session.user.id,
      name: overrideName || template.name,
      description: template.description,
      style: template.style,
      sourceImage: absoluteImageUrl,
      faceImageUrl: absoluteImageUrl,
      referenceImages: [absoluteImageUrl],
      // Adults-only seeded characters — eligible for any content mode the user opts into.
      nsfwEligible: true,
      estimatedAgeLow: 22,
      estimatedAgeHigh: 38,
    },
    select: { id: true, name: true },
  });

  return NextResponse.json({ character });
}
