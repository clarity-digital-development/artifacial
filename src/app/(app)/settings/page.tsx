import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { PLANS, type PlanKey } from "@/lib/stripe";
import { BillingClient } from "./billing-client";
import { ContentModeClient } from "./content-mode-client";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      subscriptionTier: true,
      subscriptionCredits: true,
      purchasedCredits: true,
      stripeCustomerId: true,
      isFoundingMember: true,
      contentMode: true,
      dateOfBirth: true,
    },
  });

  const tier = (user?.subscriptionTier ?? "FREE") as PlanKey;
  const planConfig = PLANS[tier];

  const recentTransactions = await prisma.creditTransaction.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      type: true,
      credits: true,
      description: true,
      createdAt: true,
    },
  });

  return (
    <div>
      <div className="mb-10">
        <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
          Settings
        </h1>
        <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
          Account and billing
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Account */}
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            Account
          </h2>
          <div className="flex items-center gap-4">
            {session.user.image ? (
              <img
                src={session.user.image}
                alt={session.user.name ?? "User"}
                className="h-14 w-14 rounded-full ring-2 ring-[var(--border-default)]"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--bg-elevated)] text-lg font-medium text-[var(--text-secondary)] ring-2 ring-[var(--border-default)]">
                {session.user.name?.[0]?.toUpperCase() ?? "U"}
              </div>
            )}
            <div>
              <p className="font-medium text-[var(--text-primary)]">
                {session.user.name ?? "User"}
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                {session.user.email}
              </p>
            </div>
          </div>
        </div>

        <ContentModeClient
          contentMode={user?.contentMode ?? "SFW"}
          hasDateOfBirth={!!user?.dateOfBirth}
        />

        <BillingClient
          tier={tier}
          planName={planConfig.name}
          subscriptionCredits={user?.subscriptionCredits ?? 0}
          purchasedCredits={user?.purchasedCredits ?? 0}
          planCredits={planConfig.credits}
          hasStripeCustomer={!!user?.stripeCustomerId}
          isFoundingMember={user?.isFoundingMember ?? false}
          transactions={recentTransactions.map((t) => ({
            id: t.id,
            type: t.type,
            credits: t.credits,
            description: t.description,
            createdAt: t.createdAt.toISOString(),
          }))}
        />
      </div>
    </div>
  );
}
