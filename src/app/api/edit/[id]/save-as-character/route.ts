import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const { id } = await params;

  const generation = await prisma.generation.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, outputUrl: true, status: true, workflowType: true },
  });

  if (!generation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (generation.status !== "COMPLETED" || !generation.outputUrl) {
    return NextResponse.json({ error: "Generation not yet completed" }, { status: 400 });
  }

  const name = body.name?.trim() || "Edited Image";

  const character = await prisma.character.create({
    data: {
      userId: session.user.id,
      name,
      style: "photorealistic",
      referenceImages: [generation.outputUrl],
    },
  });

  return NextResponse.json({ characterId: character.id });
}
