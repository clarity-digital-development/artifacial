/**
 * Generate the 12 founding-character portrait images via Nano Banana Pro
 * (gemini-3-pro-image-preview).
 *
 * Each image saved to public/founding-characters/{slug}.webp at 640x853 (3:4
 * portrait) via sharp.
 *
 * Usage: npx tsx scripts/generate-founding-characters.ts
 *        Add --force to regenerate already-existing images.
 */

import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });

import { generateImageWithGemini } from "../src/lib/gemini";
import { FOUNDING_CHARACTERS } from "../src/lib/characters/founding-pool";
import sharp from "sharp";
import { writeFile, access } from "fs/promises";
import path from "path";

async function fileExists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

async function generateOne(slug: string, prompt: string): Promise<void> {
  console.log(`\n→ ${slug}`);
  const start = Date.now();

  const buf = await generateImageWithGemini(
    prompt,
    undefined,
    "gemini-3-pro-image-preview",
    "3:4",
  );

  const out = await sharp(buf)
    .resize(640, 853, { fit: "cover", position: "center" })
    .webp({ quality: 88 })
    .toBuffer();

  const outPath = path.join("public", "founding-characters", `${slug}.webp`);
  await writeFile(outPath, out);
  console.log(`  ✓ saved ${outPath} (${out.length.toLocaleString()} bytes, ${Math.round((Date.now() - start) / 1000)}s)`);
}

async function main() {
  const force = process.argv.includes("--force");
  console.log(`Generating ${FOUNDING_CHARACTERS.length} founding-character portraits via Nano Banana Pro${force ? " [--force]" : ""}…`);
  for (const c of FOUNDING_CHARACTERS) {
    const outPath = path.join("public", "founding-characters", `${c.slug}.webp`);
    if (!force && await fileExists(outPath)) {
      console.log(`\n→ ${c.slug}  (exists, skip — pass --force to regenerate)`);
      continue;
    }
    try {
      await generateOne(c.slug, c.generationPrompt);
    } catch (err) {
      console.error(`  ✗ ${c.slug}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
