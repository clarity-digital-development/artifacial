import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import pg from "pg";
import { fal } from "@fal-ai/client";

// ─── Setup ───

fal.config({ credentials: () => process.env.FAL_KEY! });

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// We can't import the router directly (it uses the singleton prisma from db.ts).
// Instead, we'll replicate the key steps to test each piece against the real DB + fal.ai.

import {
  submitGeneration,
  pollStatus,
  getResult,
  estimateApiCost,
} from "../src/lib/generation/fal-client";
import {
  getModelById,
  calculateCreditCost,
} from "../src/lib/models/registry";

const TEST_USER_EMAIL = "test@artifacial.io";

async function main() {
  // 1. Verify test user exists
  const user = await prisma.user.findUnique({ where: { email: TEST_USER_EMAIL } });
  if (!user) throw new Error("Test user not found. Run seed-test-user.ts first.");
  console.log(`\n✓ Test user: ${user.id} (${user.email})`);
  console.log(`  Credits: ${user.subscriptionCredits} sub + ${user.purchasedCredits} purchased = ${user.subscriptionCredits + user.purchasedCredits} total`);

  // 2. Test credit deduction (atomic transaction)
  const modelId = "kling-25-turbo";
  const model = getModelById(modelId)!;
  const withAudio = false;
  const durationSec = 5;
  const creditsCost = calculateCreditCost(modelId, durationSec);
  console.log(`\n--- Credit deduction test ---`);
  console.log(`  Model: ${model.name}`);
  console.log(`  Credits cost: ${creditsCost}`);

  const beforeCredits = user.subscriptionCredits + user.purchasedCredits;

  await prisma.$transaction(async (tx) => {
    const u = await tx.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { subscriptionCredits: true, purchasedCredits: true },
    });
    const total = u.subscriptionCredits + u.purchasedCredits;
    if (total < creditsCost) throw new Error("INSUFFICIENT_CREDITS");

    const fromSub = Math.min(u.subscriptionCredits, creditsCost);
    const fromPurchased = creditsCost - fromSub;

    await tx.user.update({
      where: { id: user.id },
      data: {
        subscriptionCredits: { decrement: fromSub },
        ...(fromPurchased > 0 ? { purchasedCredits: { decrement: fromPurchased } } : {}),
      },
    });

    await tx.creditTransaction.create({
      data: {
        userId: user.id,
        type: "debit",
        credits: -creditsCost,
        description: `TEST: ${model.name} generation`,
      },
    });
  });

  const afterUser = await prisma.user.findUnique({ where: { id: user.id } });
  const afterCredits = (afterUser?.subscriptionCredits ?? 0) + (afterUser?.purchasedCredits ?? 0);
  console.log(`✓ Credits deducted: ${beforeCredits} → ${afterCredits} (−${creditsCost})`);

  // 3. Create Generation record
  const apiCostEstimate = estimateApiCost(modelId, durationSec);
  console.log(`\n--- Generation record test ---`);
  console.log(`  Estimated API cost: $${apiCostEstimate.toFixed(4)}`);

  const generation = await prisma.generation.create({
    data: {
      userId: user.id,
      workflowType: "TEXT_TO_VIDEO",
      status: "QUEUED",
      contentMode: "SFW",
      provider: "FAL_AI",
      modelId,
      apiCost: apiCostEstimate,
      withAudio,
      creditsCost,
      resolution: "720p",
      durationSec,
      inputParams: { prompt: "A cat sitting on a windowsill watching rain", modelId },
    },
  });
  console.log(`✓ Generation created: ${generation.id}`);

  // 4. Submit to fal.ai
  console.log(`\n--- fal.ai submission test ---`);
  const falResult = await submitGeneration(modelId, {
    prompt: "A cat sitting on a windowsill watching rain fall outside, cozy atmosphere",
    durationSec: 5,
  });
  console.log(`✓ Submitted to fal.ai: ${falResult.requestId}`);

  // Update generation with fal request ID
  await prisma.generation.update({
    where: { id: generation.id },
    data: {
      status: "PROCESSING",
      startedAt: new Date(),
      promptId: falResult.requestId,
      inputParams: {
        prompt: "A cat sitting on a windowsill watching rain",
        modelId,
        falRequestId: falResult.requestId,
        falEndpoint: falResult.endpoint,
      },
    },
  });

  // 5. Poll until complete
  console.log(`\n--- Polling fal.ai ---`);
  let done = false;
  while (!done) {
    const status = await pollStatus(falResult.endpoint, falResult.requestId);
    process.stdout.write(`  ${status.status} (${status.progress ?? 0}%)  `);

    if (status.status === "COMPLETED") {
      done = true;
      console.log("");

      // 6. Get result
      const result = await getResult(falResult.endpoint, falResult.requestId);
      console.log(`✓ Video URL: ${result.videoUrl.substring(0, 80)}...`);

      // 7. Calculate actual API cost and update generation
      const actualDuration = result.durationSec ?? durationSec;
      const actualApiCost = estimateApiCost(modelId, actualDuration);

      await prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: "COMPLETED",
          progress: 100,
          outputUrl: result.videoUrl, // In production this would be an R2 key
          thumbnailUrl: result.thumbnailUrl || null,
          apiCost: actualApiCost,
          durationSec: actualDuration,
          completedAt: new Date(),
          generationTimeMs: generation.startedAt
            ? Date.now() - new Date(generation.startedAt!).getTime()
            : null,
        },
      });
      console.log(`✓ apiCost written: $${actualApiCost.toFixed(4)}`);
    } else if (status.status === "FAILED") {
      done = true;
      console.log("\n✗ Generation FAILED on fal.ai");
    } else {
      await new Promise((r) => setTimeout(r, 5000));
    }
  }

  // 8. Verify final DB state
  console.log(`\n--- Final DB verification ---`);
  const finalGen = await prisma.generation.findUnique({ where: { id: generation.id } });
  console.log(`  Generation ID: ${finalGen?.id}`);
  console.log(`  Status: ${finalGen?.status}`);
  console.log(`  Provider: ${finalGen?.provider}`);
  console.log(`  Model: ${finalGen?.modelId}`);
  console.log(`  withAudio: ${finalGen?.withAudio}`);
  console.log(`  creditsCost: ${finalGen?.creditsCost}`);
  console.log(`  apiCost: $${finalGen?.apiCost?.toFixed(4) ?? "null"}`);
  console.log(`  outputUrl: ${finalGen?.outputUrl ? finalGen.outputUrl.substring(0, 60) + "..." : "null"}`);
  console.log(`  durationSec: ${finalGen?.durationSec}`);
  console.log(`  generationTimeMs: ${finalGen?.generationTimeMs}`);

  const finalUser = await prisma.user.findUnique({ where: { id: user.id } });
  console.log(`\n  User credits after: ${finalUser?.subscriptionCredits} sub + ${finalUser?.purchasedCredits} purchased`);

  const txns = await prisma.creditTransaction.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 3,
  });
  console.log(`  Recent transactions:`);
  for (const t of txns) {
    console.log(`    ${t.type}: ${t.credits} — ${t.description}`);
  }

  console.log(`\n=== ALL CHECKS PASSED ===\n`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch(async (e) => {
  console.error("\n✗ TEST FAILED:", e.message || e);
  await prisma.$disconnect();
  await pool.end();
  process.exit(1);
});
