import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { WorkshopClient } from "./workshop-client";
import { WORKSHOP_TOOLS } from "@/lib/workshop/tools";

export const metadata = {
  title: "Workshop — Artifacial",
};

// Slugs visible to all users on the public workshop page.
// Sprint 1 (2026-06-05): unhide every built tool — 12 → 32 tools.
// Roadmap: docs/higgsfield-roadmap.md §5, Day-30 target ~45 tools.
const PUBLIC_TOOL_SLUGS = [
  // ── Featured workspace ──
  "marketing-studio",

  // ── Face & Identity ──
  "photo-face-swap",
  "multi-face-swap",
  "video-face-swap",
  "virtual-try-on",
  "ai-hug",

  // ── Video Tools ──
  "talking-avatar",
  "lipsync",
  "effects",
  "kling-sound",
  "video-remove-bg",
  "watermark-remover",

  // ── Image Utilities ──
  "character-swap",
  "character-swap-remix",
  "remove-bg",
  "super-resolution",
  "recraft-crisp-upscale",
  "topaz-image-upscale",
  "grok-video-upscale",
  "joycaption",
  "trellis3d",

  // ── Audio & Music ──
  "music-gen",
  "add-audio",
  "diffrhythm",

  // ── Viral Presets ──
  "preset-ugc-hook",
  "preset-paparazzi-flash",
  "preset-slow-mo",
  "preset-magazine-cover",
  "preset-red-carpet",
  "preset-drift-racing",
  "preset-cctv",
  "preset-neon-city",
  "preset-3d-render",
  "preset-anime",
  // Sprint 1 Wave 2 (2026-06-06): preset library expansion
  "preset-kung-fu",
  "preset-zombie-dance",
  "preset-dragon-fantasy",
  "preset-night-vision",
  "preset-storm-giant",
  // Sprint 2 Wave 8 (2026-06-09): AI Hug variants
  "preset-ai-kiss",
  "preset-ai-wedding",
  "preset-ai-reunion",
  // Sprint 4 Wave 16 (2026-06-09): AI Pet Hug
  "preset-ai-pet-hug",
  // Sprint 4 Wave 17 (2026-06-09): 6 fresh presets
  "preset-snow-globe",
  "preset-tiny-person",
  "preset-disco-70s",
  "preset-skydiving",
  "preset-crystal-cave",
  "preset-spy-mission",
  // Sprint 2 Wave 10 (2026-06-09): preset library expansion
  "preset-underwater",
  "preset-vhs-90s",
  "preset-catwalk",
  "preset-polaroid-70s",
  "preset-gym-action",
  "preset-action-hero",

  // Sprint 1 Wave 3 (2026-06-06): Photodump flagship
  "photodump",
  // Sprint 1 Wave 4 (2026-06-06): Headshot Generator
  "headshot-generator",
  // Sprint 1 Wave 5 (2026-06-06): Outfit Swap
  "outfit-swap",
  // Sprint 1 Wave 6 (2026-06-06): Virality Predictor
  "virality-predictor",

  // Sprint 4 Wave 22 (2026-06-09): NSFW presets — only visible to NSFW-mode users on Starter+ tier
  "preset-boudoir-bedroom",
  "preset-wet-shower",
  "preset-lace-lingerie",
  "preset-pool-wet-look",
  "preset-silk-sheets",
  "preset-vegas-penthouse",
  "preset-oral",
];

const NSFW_ELIGIBLE_TIERS = new Set(["STARTER", "CREATOR", "PRO", "STUDIO"]);

export default async function WorkshopPage() {
  const session = await auth();
  let totalCredits = 0;
  let contentMode: string = "SFW";
  let subscriptionTier: string = "FREE";

  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { subscriptionCredits: true, purchasedCredits: true, contentMode: true, subscriptionTier: true },
    });
    if (user) {
      totalCredits = (user.subscriptionCredits ?? 0) + (user.purchasedCredits ?? 0);
      contentMode = user.contentMode ?? "SFW";
      subscriptionTier = user.subscriptionTier ?? "FREE";
    }
  }

  const nsfwEligible = contentMode === "NSFW" && NSFW_ELIGIBLE_TIERS.has(subscriptionTier);

  const visibleTools = WORKSHOP_TOOLS
    .filter((t) => PUBLIC_TOOL_SLUGS.includes(t.slug))
    .filter((t) => !t.nsfw || nsfwEligible);

  return <WorkshopClient totalCredits={totalCredits} tools={visibleTools} />;
}
