import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const caller = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!caller?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing ?id=<generationId>" }, { status: 400 });
  }

  const gen = await prisma.generation.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      modelId: true,
      provider: true,
      workflowType: true,
      status: true,
      contentMode: true,
      progress: true,
      creditsCost: true,
      durationSec: true,
      resolution: true,
      withAudio: true,
      retryCount: true,
      errorMessage: true,
      queuedAt: true,
      startedAt: true,
      completedAt: true,
      generationTimeMs: true,
      inputParams: true,
      outputUrl: true,
    },
  });

  if (!gen) {
    return NextResponse.json({ error: `No generation found with id=${id}` }, { status: 404 });
  }

  const elapsedMs = gen.completedAt
    ? gen.completedAt.getTime() - gen.queuedAt.getTime()
    : Date.now() - gen.queuedAt.getTime();

  return NextResponse.json({
    ...gen,
    elapsedSec: Math.round(elapsedMs / 1000),
  });
}
