export type ToolCategory = "face" | "video" | "image" | "audio";
export type OutputType = "image" | "video" | "audio" | "text" | "3d" | "multi-audio" | "multi-image";

export interface WorkshopTool {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: ToolCategory;
  credits: number;
  creditLabel: string;
  status: "available" | "beta";
  outputType: OutputType;
}

export const WORKSHOP_TOOLS: WorkshopTool[] = [
  // ── Featured: KIE.AI Tools ──
  {
    slug: "character-swap",
    name: "Character Swap",
    tagline: "Swap one person for another in any photo",
    description: "Upload a target photo and a character reference. The model replaces the person in the target photo with your character, preserving the original scene, background, lighting, and pose.",
    category: "image",
    credits: 240,
    creditLabel: "240 credits",
    status: "available",
    outputType: "image",
  },
  {
    slug: "character-swap-remix",
    name: "Scene Remix",
    tagline: "Swap the background or scene of any photo",
    description: "Transform the background or scene of an existing photo while keeping the subject. Provide a character reference to help maintain their appearance across the change.",
    category: "image",
    credits: 240,
    creditLabel: "from 240 cr",
    status: "available",
    outputType: "multi-image",
  },
  {
    slug: "recraft-crisp-upscale",
    name: "Crisp Upscale",
    tagline: "Upscale any image with razor-sharp detail",
    description: "Enhance your images to high resolution with Recraft's crisp upscaling engine. Perfect for sharpening AI-generated portraits and preparing images for large display.",
    category: "image",
    credits: 60,
    creditLabel: "60 credits",
    status: "available",
    outputType: "image",
  },
  {
    slug: "grok-video-upscale",
    name: "Video Upscale",
    tagline: "Upscale a KIE.AI-generated video to higher resolution",
    description: "Increase the resolution of videos that were generated via KIE.AI on this platform. Requires the original KIE.AI task ID from a completed video generation.",
    category: "video",
    credits: 600,
    creditLabel: "600 credits",
    status: "beta",
    outputType: "video",
  },

  // ── Face & Identity ──
  {
    slug: "photo-face-swap",
    name: "Photo Face Swap",
    tagline: "Replace faces in any photo instantly",
    description:
      "Upload a target photo and a source face — AI swaps the most prominent face automatically.",
    category: "face",
    credits: 40,
    creditLabel: "40 credits",
    status: "available",
    outputType: "image",
  },
  {
    slug: "multi-face-swap",
    name: "Multi-Face Swap",
    tagline: "Swap multiple faces with index control",
    description:
      "Control exactly which faces are swapped using index mapping — perfect for group photos.",
    category: "face",
    credits: 60,
    creditLabel: "60 credits",
    status: "available",
    outputType: "image",
  },
  {
    slug: "video-face-swap",
    name: "Video Face Swap",
    tagline: "Replace faces throughout an entire video",
    description:
      "Swap a face onto any MP4 video. Supports multi-face index control. Max 720p, 10 MB, 600 frames.",
    category: "face",
    credits: 2400,
    creditLabel: "~2,400 credits / 5s clip",
    status: "available",
    outputType: "video",
  },
  {
    slug: "virtual-try-on",
    name: "Virtual Try-On",
    tagline: "Dress any person in any outfit",
    description:
      "Virtually try on full outfits or mix-and-match tops and bottoms on any photo. Up to 4 results.",
    category: "face",
    credits: 280,
    creditLabel: "280 credits / image",
    status: "available",
    outputType: "multi-image",
  },
  {
    slug: "ai-hug",
    name: "AI Hug",
    tagline: "Animate two people in a warm embrace",
    description: "Transform a still photo into a heartfelt animated hugging video.",
    category: "face",
    credits: 800,
    creditLabel: "800 credits",
    status: "available",
    outputType: "video",
  },

  // ── Video Tools ──
  {
    slug: "lipsync",
    name: "Lip Sync",
    tagline: "Sync lips to any audio or custom text",
    description:
      "Make any face speak with natural lip movement. Use text-to-speech or upload your own audio.",
    category: "video",
    credits: 400,
    creditLabel: "400 credits / 5s",
    status: "beta",
    outputType: "video",
  },
  {
    slug: "effects",
    name: "Kling Effects",
    tagline: "Apply viral motion effects to photos",
    description:
      "14 cinematic and viral effects — squish, spin, hearting, kissing, surfing, and more.",
    category: "video",
    credits: 1040,
    creditLabel: "1,040–1,840 credits",
    status: "available",
    outputType: "video",
  },
  {
    slug: "kling-sound",
    name: "Add Sound",
    tagline: "Generate sound effects for any video",
    description:
      "Describe a sound and add it to your video, or generate 4 standalone audio variations.",
    category: "video",
    credits: 280,
    creditLabel: "280 credits → 4 variations",
    status: "available",
    outputType: "multi-audio",
  },
  {
    slug: "ai-video-edit",
    name: "AI Video Edit",
    tagline: "Edit videos with plain-English prompts",
    description:
      "Kling o1 understands reference images and videos — describe what you want and it generates it.",
    category: "video",
    credits: 1560,
    creditLabel: "1,560–4,160 credits",
    status: "available",
    outputType: "video",
  },
  {
    slug: "video-remove-bg",
    name: "Video Background Removal",
    tagline: "Remove or isolate backgrounds from video",
    description:
      "Cleanly cut out backgrounds from any MP4 video. Optionally invert to isolate the background.",
    category: "video",
    credits: 240,
    creditLabel: "~240 credits / 5s",
    status: "available",
    outputType: "video",
  },
  {
    slug: "watermark-remover",
    name: "Watermark Remover",
    tagline: "Clean watermarks from any video",
    description: "AI-powered watermark removal from videos up to 100 MB.",
    category: "video",
    credits: 200,
    creditLabel: "200 credits / 25s",
    status: "available",
    outputType: "video",
  },

  // ── Image Utilities ──
  {
    slug: "remove-bg",
    name: "Remove Background",
    tagline: "Cleanly cut out any subject",
    description:
      "State-of-the-art background removal with three AI model options for different use cases.",
    category: "image",
    credits: 10,
    creditLabel: "10 credits",
    status: "available",
    outputType: "image",
  },
  {
    slug: "super-resolution",
    name: "Upscale Image",
    tagline: "Sharpen and enlarge images up to 8×",
    description: "AI-powered upscaling at 2×, 4×, or 8× with optional face enhancement.",
    category: "image",
    credits: 50,
    creditLabel: "~50 credits / 2×",
    status: "available",
    outputType: "image",
  },
  {
    slug: "joycaption",
    name: "AI Caption",
    tagline: "Describe any image in rich detail",
    description:
      "Generate structured captions in multiple styles — useful for training data, alt text, and more.",
    category: "image",
    credits: 40,
    creditLabel: "40 credits",
    status: "available",
    outputType: "text",
  },
  {
    slug: "trellis3d",
    name: "Image to 3D",
    tagline: "Turn any photo into a 3D model",
    description:
      "Convert a single image into a downloadable 3D GLB model using Microsoft Trellis2.",
    category: "image",
    credits: 400,
    creditLabel: "400 credits",
    status: "available",
    outputType: "3d",
  },

  // ── Audio & Music ──
  {
    slug: "music-gen",
    name: "Music Generator",
    tagline: "Create original music from a text description",
    description:
      "Generate custom songs with AI lyrics, your own lyrics, or instrumental only. Powered by Udio.",
    category: "audio",
    credits: 200,
    creditLabel: "200 credits",
    status: "available",
    outputType: "audio",
  },
  {
    slug: "add-audio",
    name: "Add Audio to Video",
    tagline: "Give silent videos a realistic voice",
    description: "Generate and sync audio that matches the visuals of any silent video.",
    category: "audio",
    credits: 75,
    creditLabel: "75 credits / 30s",
    status: "beta",
    outputType: "video",
  },
  {
    slug: "diffrhythm",
    name: "Song Maker",
    tagline: "Create full songs with timed lyrics",
    description:
      "Generate complete songs up to 4 min 45 sec with timed lyric placement and style reference audio.",
    category: "audio",
    credits: 80,
    creditLabel: "80 credits",
    status: "available",
    outputType: "audio",
  },

  // ── Viral Presets (one-click templates) ────────────────────────────────────
  // Each preset is a curated configuration of an existing video/image model
  // with a pre-baked prompt and locked-in parameters. Users only supply their
  // character image + (optionally) one short customization.

  {
    slug: "preset-ugc-hook",
    name: "Cinematic UGC Hook",
    tagline: "Pro-quality UGC opener — your creator + your product",
    description:
      "Generates an authentic phone-style UGC video of your creator holding and showing your product. Upload both — perfect for ad hooks, product demos, and viral openers. Built on Kling 3.0 with native multi-image support, 720p, 5 seconds.",
    category: "video",
    credits: 2000,
    creditLabel: "2,000 cr · 5s · 720p",
    status: "available",
    outputType: "video",
  },
  {
    slug: "preset-paparazzi-flash",
    name: "Paparazzi Flash",
    tagline: "2000s candid paparazzi shot — your character",
    description:
      "Vintage-era candid paparazzi-style clip with bright flash bursts, motion blur, and tabloid grit. Pair your character with a quick outfit description.",
    category: "video",
    credits: 1300,
    creditLabel: "1,300 cr · 5s",
    status: "available",
    outputType: "video",
  },
  {
    slug: "preset-slow-mo",
    name: "Slow-Mo Action",
    tagline: "Hyper-detailed slow-motion of any action",
    description:
      "Cinematic 1000fps-style slow-motion of your character performing an action. Dramatic lighting, soft depth of field, action-movie quality. Powered by Kling 3.0.",
    category: "video",
    credits: 2000,
    creditLabel: "2,000 cr · 5s",
    status: "available",
    outputType: "video",
  },
  {
    slug: "preset-magazine-cover",
    name: "Magazine Cover",
    tagline: "Editorial-grade magazine cover still",
    description:
      "Single editorial magazine cover image of your character with dramatic studio lighting, glossy production quality, and space for masthead text. Pick a style or use high-fashion default.",
    category: "image",
    credits: 450,
    creditLabel: "450 cr",
    status: "available",
    outputType: "image",
  },
  {
    slug: "preset-red-carpet",
    name: "Red Carpet",
    tagline: "Glamorous premiere walk with flash bursts",
    description:
      "Hollywood-premiere style red carpet walk with rapid paparazzi flashes, golden lighting, and a confident tracking shot. Built on Kling 3.0.",
    category: "video",
    credits: 2000,
    creditLabel: "2,000 cr · 5s",
    status: "available",
    outputType: "video",
  },
  {
    slug: "preset-drift-racing",
    name: "Drift Racing",
    tagline: "High-energy car drift with motion blur",
    description:
      "Your character as the driver in a high-energy drift sequence. Tire smoke, motion blur, dramatic camera angles, action-film energy. Powered by Seedance 2 Pro VIP at 720p.",
    category: "video",
    credits: 4000,
    creditLabel: "4,000 cr · 5s · 720p",
    status: "available",
    outputType: "video",
  },
  {
    slug: "preset-cctv",
    name: "CCTV Footage",
    tagline: "Grainy surveillance-camera POV",
    description:
      "Surveillance camera-style footage with timestamp overlay, grainy low-light feel, fixed angle, and that found-footage uncanny quality. Pair with a scene description.",
    category: "video",
    credits: 1600,
    creditLabel: "1,600 cr · 5s",
    status: "available",
    outputType: "video",
  },
  {
    slug: "preset-neon-city",
    name: "Neon City",
    tagline: "Cyberpunk rain-soaked street walk",
    description:
      "Cinematic cyberpunk walk through a rain-soaked neon-lit street. Reflections, atmospheric haze, Blade Runner-grade lighting. Powered by Kling 3.0 Pro.",
    category: "video",
    credits: 2000,
    creditLabel: "2,000 cr · 5s",
    status: "available",
    outputType: "video",
  },
  {
    slug: "preset-3d-render",
    name: "3D Render Style",
    tagline: "Stylized Pixar/Disney 3D-animation look",
    description:
      "Convert your character into a polished 3D-animated render — soft shading, expressive features, animated-film quality. Built on Seedance 2 Fast VIP at 720p.",
    category: "video",
    credits: 3200,
    creditLabel: "3,200 cr · 5s · 720p",
    status: "available",
    outputType: "video",
  },
  {
    slug: "preset-anime",
    name: "Anime Transformation",
    tagline: "Anime-style transformation sequence",
    description:
      "Convert your character into anime art style with a dynamic transformation sequence — sparkles, motion lines, dramatic poses. Powered by Kling 3.0.",
    category: "video",
    credits: 2000,
    creditLabel: "2,000 cr · 5s",
    status: "available",
    outputType: "video",
  },

  // ── Sprint 1 Wave 2 (2026-06-06): viral preset expansion ──
  {
    slug: "preset-kung-fu",
    name: "Kung Fu Hit",
    tagline: "Explosive martial-arts action shot",
    description:
      "Your character executing a cinematic kung-fu attack — explosive kicks, lightning combos, dramatic motion blur. Action-film aesthetic powered by Kling 3.0.",
    category: "video",
    credits: 2000,
    creditLabel: "2,000 cr · 5s · 720p",
    status: "available",
    outputType: "video",
  },
  {
    slug: "preset-zombie-dance",
    name: "Zombie Dance",
    tagline: "Halloween-viral choreographed zombie routine",
    description:
      "Your character reimagined as a stylized zombie performing a Thriller-style dance routine. Fog-shrouded graveyard, glowing eyes, cinematic Halloween aesthetic.",
    category: "video",
    credits: 2000,
    creditLabel: "2,000 cr · 5s · 720p",
    status: "available",
    outputType: "video",
  },
  {
    slug: "preset-dragon-fantasy",
    name: "Dragon Fantasy",
    tagline: "Epic fantasy scene with a towering dragon",
    description:
      "Your character standing heroically before a massive ancient dragon. Misty mountains at dawn, fantasy-film quality cinematic lighting, mythic scale.",
    category: "video",
    credits: 2000,
    creditLabel: "2,000 cr · 5s · 720p",
    status: "available",
    outputType: "video",
  },
  {
    slug: "preset-night-vision",
    name: "Night Vision",
    tagline: "Tactical green-tint night surveillance",
    description:
      "Military-grade night-vision footage of your character moving through darkness. Monochromatic green tint, slight scanlines, low-light tactical aesthetic.",
    category: "video",
    credits: 1600,
    creditLabel: "1,600 cr · 5s · 720p",
    status: "available",
    outputType: "video",
  },
  {
    slug: "preset-storm-giant",
    name: "Storm Giant",
    tagline: "Mythological colossus transformation",
    description:
      "Your character transforming into a colossal storm giant — towering above clouds, lightning crackling, epic god-of-thunder mythological aesthetic.",
    category: "video",
    credits: 2000,
    creditLabel: "2,000 cr · 5s · 720p",
    status: "available",
    outputType: "video",
  },

  // ── Sprint 1 Wave 3 (2026-06-06): Photodump flagship ──
  {
    slug: "photodump",
    name: "Photodump",
    tagline: "12 cinematic looks of your character — one click",
    description:
      "Upload one character photo. Get 12 photorealistic scenes back — golden-hour portrait, magazine cover, Tokyo at night, Paris café, beach sunset, cyberpunk rain, mountain peak, studio fashion, exec portrait, tropical vacation, '90s yearbook, red carpet. All identity-locked to your reference. Powered by Nano Banana Pro.",
    category: "image",
    credits: 5400,
    creditLabel: "5,400 cr · 12 images",
    status: "available",
    outputType: "multi-image",
  },

  // ── Sprint 1 Wave 4 (2026-06-06): Headshot Generator ──
  {
    slug: "headshot-generator",
    name: "Headshot Generator",
    tagline: "6 polished studio headshots from one selfie",
    description:
      "Upload one photo. Get 6 professional headshots back — Corporate, Actor Headshot, LinkedIn Profile, Fashion Editorial, Creative Casual, and Fitness Athletic. Identity-locked, print-ready, powered by Nano Banana Pro.",
    category: "image",
    credits: 2700,
    creditLabel: "2,700 cr · 6 images",
    status: "available",
    outputType: "multi-image",
  },

  // ── Sprint 1 Wave 5 (2026-06-06): Outfit Swap ──
  {
    slug: "outfit-swap",
    name: "Outfit Swap",
    tagline: "Try any outfit on yourself — one click",
    description:
      "Upload a photo of yourself and a photo of any outfit. We swap the clothing onto you while keeping your face, hair, body, pose, and background exactly as in the original. Powered by Nano Banana Pro.",
    category: "image",
    credits: 450,
    creditLabel: "450 cr",
    status: "available",
    outputType: "image",
  },
];

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  face: "Face & Identity",
  video: "Video Tools",
  image: "Image Utilities",
  audio: "Audio & Music",
};

export const CATEGORY_ORDER: ToolCategory[] = ["face", "video", "image", "audio"];

export function getToolBySlug(slug: string): WorkshopTool | undefined {
  return WORKSHOP_TOOLS.find((t) => t.slug === slug);
}

// ─── WorkflowType mapping (for Generation DB records) ──────────────────────
// Workshop tools share the same Generation table as /generate, so we map each
// tool slug to the closest WorkflowType enum value. The gallery + recent
// generations API don't filter by workflowType, so the value just needs to
// be sensible for display/analytics.
import type { WorkflowType } from "@/generated/prisma/client";

export function getWorkflowTypeForTool(slug: string): WorkflowType {
  // Face & identity
  if (slug === "photo-face-swap" || slug === "multi-face-swap" || slug === "video-face-swap") return "FACE_SWAP";
  if (slug === "virtual-try-on") return "VIRTUAL_TRY_ON";
  if (slug === "ai-hug") return "AI_HUG";

  // Video tools
  if (slug === "lipsync") return "LIP_SYNC";
  if (slug === "effects" || slug === "ai-video-edit") return "IMAGE_TO_VIDEO";
  if (slug === "video-remove-bg" || slug === "remove-bg") return "BACKGROUND_REMOVAL";
  if (slug === "watermark-remover") return "IMAGE_EDIT";

  // Image utilities
  if (slug === "character-swap" || slug === "character-swap-remix") return "IMAGE_EDIT";
  if (slug === "super-resolution" || slug === "recraft-crisp-upscale" || slug === "grok-video-upscale") return "UPSCALE";
  if (slug === "joycaption" || slug === "trellis3d") return "IMAGE_EDIT";

  // Audio (no AUDIO_GEN enum value — closest match is IMAGE_TO_VIDEO since
  // these often pair audio with a video reference)
  if (slug === "kling-sound" || slug === "add-audio" || slug === "music-gen" ||
      slug === "song-extend" || slug === "diffrhythm") return "IMAGE_TO_VIDEO";

  // Viral presets
  if (slug === "preset-magazine-cover") return "TEXT_TO_IMAGE";
  if (slug.startsWith("preset-")) return "IMAGE_TO_VIDEO";

  // Multi-image batch presets
  if (slug === "photodump" || slug === "headshot-generator") return "TEXT_TO_IMAGE";

  // Outfit Swap is an image edit (garment replacement)
  if (slug === "outfit-swap") return "IMAGE_EDIT";

  return "IMAGE_EDIT";
}
