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

  // ── New Creator Tools (April 2026) ──
  {
    slug: "auto-captions",
    name: "Auto Captions",
    tagline: "Burn stylized subtitles onto any video",
    description:
      "Upload a video — we transcribe the audio word-by-word and burn captions directly onto the clip in your chosen style. Perfect for TikTok, Reels, and Shorts where most viewers watch without sound.",
    category: "video",
    credits: 500,
    creditLabel: "500 credits",
    status: "beta",
    outputType: "video",
  },
  {
    slug: "auto-clip",
    name: "Video to Shorts",
    tagline: "Turn long videos into viral shorts",
    description:
      "Drop a long-form video (podcast, interview, vlog) and we find the strongest moments, cut them into shorts, reframe to vertical, and burn captions. 5–10 ready-to-post clips from a single upload.",
    category: "video",
    credits: 4000,
    creditLabel: "from 800 cr / clip",
    status: "beta",
    outputType: "video",
  },
  {
    slug: "auto-reframe",
    name: "Smart Reframe",
    tagline: "Convert aspect ratios with subject tracking",
    description:
      "Convert any video to 9:16, 1:1, 4:5, or 16:9 with intelligent subject tracking. The subject stays centered frame-by-frame — no awkward middle crops.",
    category: "video",
    credits: 400,
    creditLabel: "400 credits / minute",
    status: "beta",
    outputType: "video",
  },
  {
    slug: "voice-clone",
    name: "Voice Clone",
    tagline: "Clone your voice from a 30-second sample",
    description:
      "Upload 30 seconds of clean audio. We clone your voice and generate natural narration from any script — pair with Talking Avatar or Lip Sync for fully personalized content.",
    category: "audio",
    credits: 500,
    creditLabel: "~500 credits",
    status: "beta",
    outputType: "audio",
  },
  {
    slug: "talking-avatar",
    name: "AI Talking Avatar",
    tagline: "Make any character speak your script",
    description:
      "Pick a character from your library (or upload a photo) and type a script. We generate a lip-synced talking video with your chosen voice — stock voices or your own cloned voice.",
    category: "face",
    credits: 1200,
    creditLabel: "1,200 cr / 30s",
    status: "beta",
    outputType: "video",
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
