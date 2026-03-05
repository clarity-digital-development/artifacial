import { prisma } from "@/lib/db";

/**
 * Get the user's total available credits (subscription + purchased).
 */
export async function getAvailableCredits(userId: string): Promise<{
  subscription: number;
  purchased: number;
  total: number;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionCredits: true, purchasedCredits: true },
  });

  const subscription = user?.subscriptionCredits ?? 0;
  const purchased = user?.purchasedCredits ?? 0;

  return { subscription, purchased, total: subscription + purchased };
}

/**
 * Deduct credits from a user's balance. Consumes subscription credits first,
 * then purchased credits. Returns false if insufficient credits.
 */
export async function deductCredits(
  userId: string,
  amount: number,
  description: string,
  type: string = "debit"
): Promise<boolean> {
  const { subscription, purchased, total } = await getAvailableCredits(userId);

  if (total < amount) return false;

  // Calculate split: subscription credits consumed first
  const fromSubscription = Math.min(subscription, amount);
  const fromPurchased = amount - fromSubscription;

  await prisma.user.update({
    where: { id: userId },
    data: {
      subscriptionCredits: { decrement: fromSubscription },
      ...(fromPurchased > 0
        ? { purchasedCredits: { decrement: fromPurchased } }
        : {}),
    },
  });

  await prisma.creditTransaction.create({
    data: {
      userId,
      type,
      credits: -amount,
      description,
    },
  });

  return true;
}

/**
 * Refund credits to a user (always goes to purchasedCredits since
 * subscription credits may have been reset by a renewal).
 */
export async function refundCredits(
  userId: string,
  amount: number,
  description: string
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { purchasedCredits: { increment: amount } },
  });

  await prisma.creditTransaction.create({
    data: {
      userId,
      type: "refund",
      credits: amount,
      description,
    },
  });
}
