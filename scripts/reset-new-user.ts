/**
 * Reset an existing account to look like a brand-new free user.
 * Useful for testing the onboarding tutorial.
 *
 * Usage:
 *   npx tsx scripts/reset-new-user.ts user@example.com
 *
 * What it resets (DB):
 *   - subscriptionTier → FREE
 *   - subscriptionCredits → 1000
 *   - purchasedCredits → 0
 *   - stripeSubscriptionId → null
 *   - isFoundingMember → false
 *
 * What you must clear manually (browser localStorage):
 *   localStorage.removeItem("artifacial_tutorial_done")
 *   localStorage.removeItem("artifacial_tutorial_phase")
 */

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const email = process.argv[2];

async function main() {
  if (!email) {
    console.error("Usage: npx tsx scripts/reset-new-user.ts <email>");
    process.exit(1);
  }

  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, subscriptionTier: true },
  });

  if (!user) {
    console.error(`No user found with email: ${email}`);
    await pool.end();
    process.exit(1);
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionTier: "FREE",
      subscriptionCredits: 1000,
      purchasedCredits: 0,
      stripeSubscriptionId: null,
      isFoundingMember: false,
      foundingMemberPriceId: null,
      foundingMemberPlan: null,
    },
    select: { email: true, subscriptionTier: true, subscriptionCredits: true, purchasedCredits: true },
  });

  console.log(`✓ Reset ${updated.email} to new-user state:`);
  console.log(`  Tier: ${updated.subscriptionTier}`);
  console.log(`  Credits: ${updated.subscriptionCredits} subscription + ${updated.purchasedCredits} purchased`);
  console.log(``);
  console.log(`Next: clear localStorage in the browser for this account:`);
  console.log(`  localStorage.removeItem("artifacial_tutorial_done")`);
  console.log(`  localStorage.removeItem("artifacial_tutorial_phase")`);
  console.log(``);
  console.log(`Or paste this in the browser console:`);
  console.log(`  ["artifacial_tutorial_done","artifacial_tutorial_phase"].forEach(k => localStorage.removeItem(k))`);

  await pool.end();
}

main();
