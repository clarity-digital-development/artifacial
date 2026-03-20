import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import pg from "pg";

async function seed() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const user = await prisma.user.upsert({
    where: { email: "test@artifacial.io" },
    update: { subscriptionCredits: 100 },
    create: {
      email: "test@artifacial.io",
      name: "Test User",
      subscriptionCredits: 100,
      purchasedCredits: 0,
      subscriptionTier: "STARTER",
    },
  });

  console.log("Seeded user:", user.id, user.email);
  console.log("Credits:", user.subscriptionCredits, "sub +", user.purchasedCredits, "purchased");
  console.log("Tier:", user.subscriptionTier);

  await prisma.$disconnect();
  await pool.end();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
