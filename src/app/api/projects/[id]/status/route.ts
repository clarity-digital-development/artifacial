import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSignedR2Url } from "@/lib/r2";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: projectId } = await params;

  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: session.user.id },
    select: {
      status: true,
      finalVideoUrl: true,
      prompt: true,
      enhancedPrompt: true,
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Get the latest generation job for progress info
  const latestJob = await prisma.generationJob.findFirst({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, error: true, createdAt: true },
  });

  // Generate signed URL for completed videos
  let signedVideoUrl: string | null = null;
  if (project.status === "complete" && project.finalVideoUrl) {
    try {
      signedVideoUrl = await getSignedR2Url(project.finalVideoUrl, 3600);
    } catch {
      // R2 may not be configured
    }
  }

  return NextResponse.json({
    status: project.status,
    videoUrl: signedVideoUrl,
    error: latestJob?.status === "failed" ? latestJob.error : null,
    jobId: latestJob?.id ?? null,
  });
}
