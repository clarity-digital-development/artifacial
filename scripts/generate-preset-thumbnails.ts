/**
 * Generate thumbnails for the 5 viral workshop presets using Google Gemini
 * (Nano Banana Pro: gemini-3-pro-image-preview).
 *
 * Each preset gets a 16:9 image saved to public/workshop-thumbs/{slug}.webp
 * Resized and converted via sharp.
 *
 * Usage: npx tsx scripts/generate-preset-thumbnails.ts
 */

import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: ".env.local" });

import { generateImageWithGemini } from "../src/lib/gemini";
import sharp from "sharp";
import { writeFile } from "fs/promises";
import path from "path";

type ThumbSpec = {
  slug: string;
  prompt: string;
};

const THUMBS: ThumbSpec[] = [
  {
    slug: "preset-ugc-hook",
    prompt:
      "Authentic UGC-style phone selfie of a 24-year-old woman in a sunny kitchen holding a glossy cosmetics bottle toward the camera with a genuine excited expression. Natural soft window light, slight handheld camera shake aesthetic, casual home setting visible in background, phone-camera realism (NOT cinematic), warm color grade. Composition feels like a viral TikTok product reveal.",
  },
  {
    slug: "preset-paparazzi-flash",
    prompt:
      "Vintage 2000s candid paparazzi tabloid photograph of a stylish young woman in black sunglasses and a leather jacket walking quickly through a crowd at night. Multiple bright camera flash bursts firing from the edges of the frame creating intense lens flare, heavy motion blur, grainy 35mm film aesthetic, urban street background, raw documentary energy.",
  },
  {
    slug: "preset-slow-mo",
    prompt:
      "Hyper-realistic slow-motion freeze-frame of an athletic young man mid-action — a dynamic spin kick captured at the apex of motion. 1000fps cinematic quality, extreme detail, dramatic side-lighting with a strong key light, shallow depth of field, motion-blur trails on the limbs only, fluid physics, action-movie quality. Dark moody background.",
  },
  {
    slug: "preset-magazine-cover",
    prompt:
      "Premium high-fashion editorial magazine cover photograph of a beautiful woman with sharp cheekbones and dramatic eye makeup. Dramatic studio lighting with a single key light, glossy production quality, sharp focus on the face, soft seamless dark background, Vogue-level quality, color-graded for print. Bold imaginary magazine title text 'STUDIO' across the top in clean serif type.",
  },
  {
    slug: "preset-red-carpet",
    prompt:
      "A glamorous young woman in an elegant black evening gown walking confidently on a glossy red carpet at a Hollywood film premiere. Multiple bright paparazzi camera flashes firing from both sides creating dramatic lens flares, warm golden cinematic key lighting on her face, slight motion blur on the flashes, premiere step-and-repeat backdrop visible behind her, sophisticated atmosphere. Cinematic wide framing.",
  },
];

async function generateOne(spec: ThumbSpec): Promise<void> {
  console.log(`\n→ ${spec.slug}`);
  const start = Date.now();

  // Use Nano Banana Pro (gemini-3-pro-image-preview), 16:9 aspect
  const buf = await generateImageWithGemini(
    spec.prompt,
    undefined,
    "gemini-3-pro-image-preview",
    "16:9"
  );

  // Convert to webp at 640x360 (16:9 thumbnail size)
  const out = await sharp(buf)
    .resize(640, 360, { fit: "cover", position: "center" })
    .webp({ quality: 85 })
    .toBuffer();

  const outPath = path.join("public", "workshop-thumbs", `${spec.slug}.webp`);
  await writeFile(outPath, out);
  console.log(`  ✓ saved ${outPath} (${out.length.toLocaleString()} bytes, ${Math.round((Date.now() - start) / 1000)}s)`);
}

async function main() {
  console.log("Generating 5 preset thumbnails via Nano Banana Pro (Gemini)...");
  for (const spec of THUMBS) {
    try {
      await generateOne(spec);
    } catch (err) {
      console.error(`  ✗ ${spec.slug}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
