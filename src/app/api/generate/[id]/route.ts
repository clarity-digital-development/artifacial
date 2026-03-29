import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { refundCredits } from "@/lib/credits";

/**
 * DELETE /api/generate/[id]
 *
 * Cancel an in-progress generation (QUEUED/PROCESSING) — marks as FAILED and refunds credits.
 * Delete a completed/failed generation — removes the DB record.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const generation = await prisma.generation.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, status: true, creditsCost: true, modelId: true, errorMessage: true },
  });

  if (!generation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // In-progress — cancel: refund credits and mark failed
  if (generation.status === "QUEUED" || generation.status === "PROCESSING") {
    if (generation.errorMessage !== "ACCOUNT_DELETED") {
      await refundCredits(
        session.user.id,
        generation.creditsCost,
        `Refund: Generation cancelled by user (${generation.modelId})`
      );
    }
    await prisma.generation.update({
      where: { id },
      data: { status: "FAILED", errorMessage: "Cancelled by user", completedAt: new Date() },
    });
    return NextResponse.json({ ok: true, action: "cancelled" });
  }

  // Completed or failed — delete the record
  // Note: R2 files (output, thumbnail) are left in place and will be orphaned.
  // A background cleanup job can sweep temp/ and expired keys periodically.
  await prisma.generation.delete({ where: { id } });
  return NextResponse.json({ ok: true, action: "deleted" });
}
