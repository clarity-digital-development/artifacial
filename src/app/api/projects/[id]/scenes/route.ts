import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const scenes = await prisma.scene.findMany({
    where: { projectId: id, project: { userId: session.user.id } },
    orderBy: { order: "asc" },
  });

  return NextResponse.json(scenes);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
    include: { scenes: { orderBy: { order: "desc" }, take: 1 } },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await req.json();
  const nextOrder = (project.scenes[0]?.order ?? -1) + 1;

  const scene = await prisma.scene.create({
    data: {
      projectId: id,
      characterId: body.characterId ?? project.characterId,
      order: nextOrder,
      prompt: body.prompt,
      duration: body.duration ?? 3,
      cameraPreset: body.cameraPreset,
    },
  });

  return NextResponse.json(scene, { status: 201 });
}
