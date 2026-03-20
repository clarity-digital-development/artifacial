import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { PLANS, type PlanKey } from "@/lib/stripe";
import { BillingClient } from "./billing-client";
import { ContentModeClient } from "./content-mode-client";
import { ProfileSection, DangerZoneSection } from "./settings-client";

export default async function SettingsPage() {
  const session = await auth();
  // TODO: re-enable auth redirect before shipping
  // if (!session?.user?.id) redirect("/sign-in");
  const userId = session?.user?.id;

  const user = userId ? await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      subscriptionTier: true,
      subscriptionCredits: true,
      purchasedCredits: true,
      stripeCustomerId: true,
      isFoundingMember: true,
      contentMode: true,
      dateOfBirth: true,
    },
  }) : null;

  const tier = (user?.subscriptionTier ?? "FREE") as PlanKey;
  const planConfig = PLANS[tier];

  const recentTransactions = userId ? await prisma.creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      type: true,
      credits: true,
      description: true,
      createdAt: true,
    },
  }) : [];

  return (
    <div>
      <div className="mb-10">
        <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
          Settings
        </h1>
        <p className="mt-1.5 text-sm text-[var(--text-secondary)]">
          Account, preferences, and billing
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column — Account & Preferences */}
        <div className="space-y-6">
          <ProfileSection
            initialName={user?.name ?? session?.user?.name ?? "Preview"}
            email={session?.user?.email ?? "preview@test.com"}
            image={session?.user?.image ?? null}
          />

          <ContentModeClient
            contentMode={user?.contentMode ?? "SFW"}
            hasDateOfBirth={!!user?.dateOfBirth}
            subscriptionTier={user?.subscriptionTier ?? "FREE"}
          />

          <DangerZoneSection />
        </div>

        {/* Right column — Billing & Credits */}
        <div className="space-y-6">
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
    </div>
  );
}
