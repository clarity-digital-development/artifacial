import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

/**
 * Log a moderation event to the ModerationEvent table.
 * Never delete these records — they form the audit trail for
 * compliance, appeals, and safety reviews.
 */
export async function logModerationEvent(
  userId: string,
  type: string,
  reason: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.moderationEvent.create({
      data: {
        userId,
        type,
        reason,
        metadata: (metadata ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (error) {
    // Audit logging should never crash the request — log and continue
    console.error("Failed to write moderation event:", error);
  }
}

/**
 * Get moderation history for a user (for admin review or appeals).
 */
export async function getUserModerationHistory(
  userId: string,
  limit: number = 50
) {
  return prisma.moderationEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
