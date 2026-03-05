import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function verifyOwnership(projectId: string, sceneId: string, userId: string) {
  return prisma.scene.findFirst({
    where: {
      id: sceneId,
      projectId,
      project: { userId },
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sceneId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, sceneId } = await params;
  const scene = await verifyOwnership(id, sceneId, session.user.id);
  if (!scene) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const updated = await prisma.scene.update({
    where: { id: sceneId },
    data: {
      ...(body.prompt !== undefined && { prompt: body.prompt }),
      ...(body.duration !== undefined && { duration: body.duration }),
      ...(body.cameraPreset !== undefined && { cameraPreset: body.cameraPreset }),
      ...(body.order !== undefined && { order: body.order }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; sceneId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, sceneId } = await params;
  const scene = await verifyOwnership(id, sceneId, session.user.id);
  if (!scene) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.scene.delete({ where: { id: sceneId } });

  // Re-order remaining scenes
  const remaining = await prisma.scene.findMany({
    where: { projectId: id },
    orderBy: { order: "asc" },
  });

  await Promise.all(
    remaining.map((s, i) =>
      prisma.scene.update({ where: { id: s.id }, data: { order: i } })
    )
  );

  return NextResponse.json({ success: true });
}
