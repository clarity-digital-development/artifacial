import { prisma } from "@/lib/db";
import { logModerationEvent } from "./audit-log";

/**
 * Strike thresholds — how many strikes before a ban.
 */
const STRIKE_THRESHOLDS: Record<string, number> = {
  MINOR_SEXUAL_PROMPT: 1,       // Instant ban
  MINOR_FACE_EXPLICIT: 1,       // Instant ban
  REAL_PERSON_DEEPFAKE: 3,      // 3 strikes
  SFW_VIOLATION: 5,             // 5 strikes
};

/**
 * Increment a user's strike count and ban if threshold reached.
 * Returns whether the user was banned.
 */
export async function incrementStrike(
  userId: string,
  violationType: string,
  metadata?: Record<string, unknown>
): Promise<{ banned: boolean; strikeCount: number }> {
  const threshold = STRIKE_THRESHOLDS[violationType] ?? 5;

  const user = await prisma.user.update({
    where: { id: userId },
    data: { strikeCount: { increment: 1 } },
    select: { strikeCount: true, stripeSubscriptionId: true },
  });

  await logModerationEvent(userId, "STRIKE_ISSUED", violationType, {
    ...metadata,
    newStrikeCount: user.strikeCount,
    threshold,
  });

  if (user.strikeCount >= threshold) {
    try {
      await banUser(userId, `Banned: ${violationType} (${user.strikeCount} strikes)`);
    } catch (error) {
      // Ban write failed — log but still treat as banned to prevent further access
      console.error("Failed to write ban to DB (will retry on next request):", error);
      await logModerationEvent(userId, "BAN_WRITE_FAILED", violationType, {
        error: String(error),
        strikeCount: user.strikeCount,
        threshold,
      });
    }

    // Cancel Stripe subscription if active
    if (user.stripeSubscriptionId) {
      try {
        const { getStripe } = await import("@/lib/stripe");
        await getStripe().subscriptions.cancel(user.stripeSubscriptionId);
      } catch (error) {
        console.error("Failed to cancel subscription on ban:", error);
      }
    }

    return { banned: true, strikeCount: user.strikeCount };
  }

  return { banned: false, strikeCount: user.strikeCount };
}

/**
 * Ban a user account. Sets bannedAt, forces SFW mode.
 */
async function banUser(userId: string, reason: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      bannedAt: new Date(),
      banReason: reason,
      contentMode: "SFW",
    },
  });

  await logModerationEvent(userId, "USER_BANNED", reason);
}

/**
 * Check if a user is currently banned.
 */
export async function isUserBanned(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { bannedAt: true },
  });
  return user?.bannedAt !== null && user?.bannedAt !== undefined;
}
