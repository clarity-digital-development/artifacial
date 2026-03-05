import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const characters = await prisma.character.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(characters);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const character = await prisma.character.create({
      data: {
        userId: session.user.id,
        name: body.name,
        description: body.description,
        style: body.style,
        sourceImage: body.sourceImage,
        referenceImages: body.referenceImages ?? [],
      },
    });

    return NextResponse.json(character, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Failed to create character" }, { status: 500 });
  }
}
