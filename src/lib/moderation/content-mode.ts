import { prisma } from "@/lib/db";
import type { ContentMode } from "@/generated/prisma/client";

export type ContentModeCheck = {
  effectiveMode: ContentMode;
  reason?: string;
};

/**
 * Determine the effective content mode for a generation request.
 * Checks three conditions for NSFW access:
 * 1. User contentMode must be NSFW
 * 2. User must have dateOfBirth confirming 18+
 * 3. Character nsfwEligible must be true (if character is used)
 *
 * If any condition fails, generation runs in SFW mode regardless.
 */
export async function resolveContentMode(
  userId: string,
  characterId?: string | null
): Promise<ContentModeCheck> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      contentMode: true,
      dateOfBirth: true,
      bannedAt: true,
      subscriptionTier: true,
      isAdmin: true,
    },
  });

  if (!user) {
    return { effectiveMode: "SFW", reason: "User not found" };
  }

  if (user.bannedAt) {
    return { effectiveMode: "SFW", reason: "User account is banned" };
  }

  // If user hasn't opted into NSFW, stay SFW
  if (user.contentMode !== "NSFW") {
    return { effectiveMode: "SFW" };
  }

  // Admins bypass all NSFW eligibility checks (tier, age, character)
  if (user.isAdmin) {
    return { effectiveMode: "NSFW" };
  }

  // Auto-heal: if user has NSFW enabled but downgraded to FREE tier, force SFW
  if (user.subscriptionTier === "FREE") {
    await prisma.user.update({
      where: { id: userId },
      data: { contentMode: "SFW" },
    });
    return { effectiveMode: "SFW", reason: "Subscription required for NSFW content" };
  }

  // Verify age confirmation (18+)
  if (!user.dateOfBirth) {
    return {
      effectiveMode: "SFW",
      reason: "Age verification required for NSFW content",
    };
  }

  const age = calculateAge(user.dateOfBirth);
  if (age < 18) {
    return {
      effectiveMode: "SFW",
      reason: "Must be 18+ for NSFW content",
    };
  }

  // If a character is involved, check nsfwEligible (scoped to user for ownership)
  if (characterId) {
    const character = await prisma.character.findFirst({
      where: { id: characterId, userId },
      select: { nsfwEligible: true },
    });

    if (!character) {
      return {
        effectiveMode: "SFW",
        reason: "Character not found or not owned by user",
      };
    }

    if (!character.nsfwEligible) {
      return {
        effectiveMode: "SFW",
        reason: "Character not eligible for NSFW generation (estimated age under 25)",
      };
    }
  }

  return { effectiveMode: "NSFW" };
}

function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())
  ) {
    age--;
  }
  return age;
}
