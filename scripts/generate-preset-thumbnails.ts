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
import { writeFile, access } from "fs/promises";
import path from "path";

async function fileExists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

type ThumbSpec = {
  slug: string;
  prompt: string;
};

const THUMBS: ThumbSpec[] = [
  // ── Sprint 1 (2026-06-05) — newly unhidden tools ──
  {
    slug: "photo-face-swap",
    prompt:
      "Cinematic split-screen before/after thumbnail with sharp vertical divider. Left: a young woman with brunette hair smiling in a natural outdoor setting, golden hour lighting. Right: the exact same scene composition, same hair color, same outdoor background and lighting — but the face has been swapped to a different woman with green eyes and freckles. Identical pose, identical clothing. Subtle small white labels 'BEFORE' and 'AFTER' in opposite bottom corners. Demonstration of one-shot face swap.",
  },
  {
    slug: "multi-face-swap",
    prompt:
      "Group portrait photograph of four young adults at an outdoor café table, candid laughing. Subtle numbered translucent badges hovering over each person — '1', '2', '3', '4' in clean white sans-serif circles. Natural daylight, sharp focus, professional photography aesthetic. Demonstrates face-index control for swapping specific people in a group photo.",
  },
  {
    slug: "video-face-swap",
    prompt:
      "Filmstrip-style horizontal layout showing 4 consecutive frames from a short video clip of a person speaking to camera — each frame slightly different facial expression (smiling, laughing, thoughtful, confident). All four frames show the SAME swapped face on a consistent body / clothing / background. Cinematic warm color grading, looks like a TikTok creator video. Thin black filmstrip borders between frames.",
  },
  {
    slug: "virtual-try-on",
    prompt:
      "Editorial split-screen fashion shot. Left: a young woman in a casual gray hoodie and jeans against a clean white studio background, full-body shot. Right: same woman in same pose and lighting but now wearing an elegant red evening dress instead. The transformation is the only difference. Glossy fashion-magazine quality. Subtle small labels 'BEFORE' and 'AFTER'.",
  },
  {
    slug: "ai-hug",
    prompt:
      "Heartwarming photograph of two young adults — a man and a woman — sharing a warm tight embrace, eyes closed, gentle smiles. Soft golden hour backlight, blurred park background, intimate emotional moment. Cinematic depth of field, warm color grade. Captures the feeling of reunion. Demonstrates AI Hug video generation.",
  },
  {
    slug: "lipsync",
    prompt:
      "Tight close-up portrait of a young woman mid-speech, mouth slightly open showing realistic lip motion, eyes focused at the camera, expressive face. Subtle audio-waveform graphic visible as a faint translucent overlay near her mouth, suggesting lip-sync audio sync. Cinematic studio lighting, magazine-quality realism. Modern minimalist composition.",
  },
  {
    slug: "effects",
    prompt:
      "Bold viral-effect grid thumbnail: 2x2 collage of four small action stills — top-left a person dramatically spinning with motion blur, top-right hearts floating in pink, bottom-left jumping with explosive water splash, bottom-right kung-fu kick with smoke trail. Each panel has slightly different color treatment. Thin black dividers between panels. TikTok creator-effects aesthetic, energetic, eye-catching.",
  },
  {
    slug: "kling-sound",
    prompt:
      "Dramatic video still of an action scene — a sports car at night with neon reflections — paired with a glowing translucent sound waveform graphic overlaying the lower third of the frame. Bold orange and white waveform lines pulsing across the image. Demonstrates AI sound generation for video. Cinematic, high-energy composition.",
  },
  {
    slug: "ai-video-edit",
    prompt:
      "Dark video editing software interface mockup, clean modern aesthetic. A horizontal video timeline at the bottom with multiple clip thumbnails. Above the timeline, a glowing AI prompt chat bubble: 'Make this scene cinematic.' A preview window in the center shows a high-quality video frame being transformed. Sharp UI, amber/orange accents, professional video editor feel.",
  },
  {
    slug: "video-remove-bg",
    prompt:
      "A young woman standing in athletic pose, perfectly isolated from any background — clean alpha channel cutout. The background is a tasteful soft checkerboard pattern (transparent-style) indicating no background. Sharp edge separation on her hair, professional rotoscoping quality. Demonstrates clean background removal from video.",
  },
  {
    slug: "watermark-remover",
    prompt:
      "Cinematic split-screen before/after of a video frame. Left: a beautiful landscape shot with a large translucent watermark text 'SAMPLE FOOTAGE' overlaid in the corner and a faint diagonal repeating watermark pattern. Right: the exact same landscape shot with all watermarks cleanly removed, pristine. Subtle 'BEFORE' / 'AFTER' labels.",
  },
  {
    slug: "character-swap-remix",
    prompt:
      "Cinematic split image of a single young woman placed in two completely different scenes. Left: the woman in a snowy alpine mountain village at sunrise. Right: the same woman in the exact same outfit and pose but now standing on a rooftop overlooking Tokyo at night, with neon city lights. Identical character, different scenes. Demonstrates scene-remix capability.",
  },
  {
    slug: "remove-bg",
    prompt:
      "A young woman with brunette hair in a stylish denim jacket, isolated cleanly from any background — clean alpha cutout. Background is a tasteful soft transparency checkerboard pattern. Sharp edge details on her hair, professional cutout quality. Studio portrait look.",
  },
  {
    slug: "super-resolution",
    prompt:
      "Cinematic split-screen demonstrating image upscaling. Left half: a small, low-resolution, pixelated thumbnail-style image of a young woman with visible blockiness and JPEG artifacts. Right half: the same woman blown up to ultra-high resolution with razor-sharp detail — every eyelash, hair strand, and pore visible, magazine-quality clarity. Small labels '512px' and '4K' in opposite corners.",
  },
  {
    slug: "grok-video-upscale",
    prompt:
      "Cinematic split-screen of a video frame. Left: a soft, slightly blurry video frame of a person walking through a busy urban street, low-resolution feel, slight motion blur and softness. Right: the exact same frame but in ultra-high-resolution crisp 4K detail — sharp clothing texture, visible facial detail, every leaf on background trees. Subtle small labels '720p' and '4K'.",
  },
  {
    slug: "joycaption",
    prompt:
      "Modern minimalist composition: a glossy photograph of a young woman with red hair smiling on the left half, and on the right half a clean dark panel with white text in a typewriter font reading 'A young woman with shoulder-length red hair smiles confidently at the camera, wearing a green knit sweater. Soft natural window light…'. The text suggests structured AI-generated image captioning. Sharp typography, editorial layout.",
  },
  {
    slug: "trellis3d",
    prompt:
      "Cinematic composition showing a photograph of a person on the left side, and on the right side a glowing 3D wireframe mesh model of the same person emerging from the photo — translucent triangular mesh facets, slight blue-cyan glow lines on the wireframe edges, suggesting image-to-3D conversion. Dark background, technical-magic aesthetic. Demonstrates the Trellis 3D model generation.",
  },
  {
    slug: "music-gen",
    prompt:
      "Stylized album-cover aesthetic — a glowing musical waveform shaped abstractly to look like a soundwave through the frame, with translucent musical notes floating around it. Rich purple-and-orange gradient background, cinematic studio lighting feel. No text. Suggests AI music generation. Polished editorial album art quality.",
  },
  {
    slug: "add-audio",
    prompt:
      "A movie-poster-style video frame showing dramatic outdoor action — a stunt jumping over rocks at sunset — paired with a bold translucent stylized audio waveform graphic overlaying the lower portion of the frame. The waveform suggests added sound effects perfectly matching the visual action. Cinematic warm color grade.",
  },
  {
    slug: "diffrhythm",
    prompt:
      "Stylized album cover art with abstract flowing colored gradients (sunset oranges and deep blues), centered overlay of stylized song lyrics in elegant white script across the middle: 'Chasing the night / breaking the silence / we sing till the dawn'. Suggests AI-generated full songs with timed lyrics. Editorial album art quality, no other text.",
  },

  // ── Existing thumbnails (skipped if already present) ──
  {
    slug: "recraft-crisp-upscale",
    prompt:
      "Cinematic split-screen comparison thumbnail with a sharp vertical center divider. Left half: a soft, slightly blurry, lower-resolution portrait of a young woman with brown hair against a soft studio background — visible JPEG compression and softness, lower fidelity. Right half: the exact same woman in the exact same pose and lighting, but rendered in razor-sharp ultra-high-resolution detail — every eyelash, individual hair, skin pore, and fabric texture visible, pristine clarity, magazine-print sharpness. Subtle small white labels 'SOFT' on the bottom-left corner and 'CRISP' on the bottom-right corner. Tight close-up framing.",
  },
  {
    slug: "character-swap",
    prompt:
      "Cinematic split-screen before/after thumbnail with a sharp vertical center divider. Left half: a young man with short dark hair, a trimmed beard, and a charcoal sweater standing in a softly lit modern café — natural window light, shallow depth of field. Right half: the exact same scene composition, identical pose, identical lighting, identical café background — but the subject has been swapped to a young woman with long honey-blonde hair, green eyes, and a cream knit sweater. Small subtle white labels 'BEFORE' on bottom-left and 'AFTER' on bottom-right corners. Wide cinematic framing.",
  },
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
  {
    slug: "preset-drift-racing",
    prompt:
      "High-energy cinematic action shot of a matte-black tuned sports car mid-drift at night on a wet city street. Thick white tire smoke billowing dramatically, neon street reflections on the wet pavement, intense motion blur, low-angle shot, action-film color grading, pink and cyan neon glows in the background, atmospheric haze.",
  },
  {
    slug: "preset-cctv",
    prompt:
      "Grainy black-and-white surveillance CCTV camera still frame. A person walking alone down an empty office hallway at night, captured from a fixed high-angle camera mount. Slight fisheye distortion visible, dim emergency lighting only, vignette in the corners, heavy tape-noise grain, white timestamp text burned into the top-right corner reading 'CAM 04 — 02:47:13'. Uncanny found-footage feel.",
  },
  {
    slug: "preset-neon-city",
    prompt:
      "A lone figure in a long coat walking slowly through a rain-soaked cyberpunk neon-lit street at night, seen from behind in a wide cinematic shot. Tall glowing pink and cyan billboards reflecting off the wet pavement, atmospheric haze, Blade Runner aesthetic, shallow depth of field, moody contemplative composition.",
  },
  {
    slug: "preset-3d-render",
    prompt:
      "Polished Pixar/Disney-style 3D character render of a friendly young woman with slightly enlarged expressive eyes, warm soft subsurface skin shading, gentle smile. Animation-studio quality, warm cinematic key light, soft bokeh background, color-graded for theatrical release.",
  },
  {
    slug: "preset-anime",
    prompt:
      "High-quality cinematic anime artwork in the style of Makoto Shinkai / Studio Trigger. A young woman in dynamic transformation pose, glowing magical energy particles swirling around her, dramatic motion lines streaking behind her, vibrant cel-shaded coloring, sparkles, expressive eyes, modern anime film aesthetic. Wide framing.",
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
  const force = process.argv.includes("--force");
  console.log(`Generating preset thumbnails via Nano Banana Pro (Gemini)${force ? " [--force, regenerating all]" : " [skipping existing]"}...`);
  for (const spec of THUMBS) {
    const outPath = path.join("public", "workshop-thumbs", `${spec.slug}.webp`);
    if (!force && await fileExists(outPath)) {
      console.log(`\n→ ${spec.slug}  (already exists, skipping — pass --force to regenerate)`);
      continue;
    }
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
