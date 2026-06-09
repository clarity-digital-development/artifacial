import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getToolBySlug, getWorkflowTypeForTool, type WorkshopTool } from "@/lib/workshop/tools";
import { deductCredits, refundCredits } from "@/lib/credits";
import { submitTask } from "@/lib/piapi-client";
import { uploadToR2, getSignedR2Url } from "@/lib/r2";
import { prisma } from "@/lib/db";
import { randomUUID } from "crypto";
import {
  submitIdeogramCharacterRemix,
  submitRecraftCrispUpscale,
  submitGrokVideoUpscale,
  submitTopazImageUpscale,
} from "@/lib/kieai";
import { sanitizeClientError } from "@/lib/errors";
import type { Prisma } from "@/generated/prisma/client";
import { PHOTODUMP_SCENES } from "@/lib/workshop/presets/photodump-scenes";
import { HEADSHOT_SCENES } from "@/lib/workshop/presets/headshot-scenes";
import type { SceneTemplate } from "@/lib/workshop/presets/types";
import { analyzeVirality } from "@/lib/analysis/virality";
import { safeFetchUserUrl } from "@/lib/security/safe-fetch";
import { detectKling3Omni, submitKling3OmniRouted } from "@/lib/generation/provider-router";
import { submitVeniceVideo } from "@/lib/venice";
import { compositeSideBySideToR2 } from "@/lib/uploads/composite";

// ─── Generation record helper ─────────────────────────────────────────────────
// Creates a Generation row at workshop submission so the result shows up in
// the user's gallery / recent generations once polling completes.

function stripHeavyKeys(body: Record<string, unknown>): Record<string, unknown> {
  // base64 data URLs are huge and bloat the inputParams JSON column
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (typeof v === "string" && v.startsWith("data:")) continue;
    out[k] = v;
  }
  return out;
}

async function createWorkshopGeneration(opts: {
  userId: string;
  slug: string;
  tool: WorkshopTool;
  credits: number;
  taskId: string;
  provider: "PIAPI" | "KIEAI";
  body: Record<string, unknown>;
}): Promise<string> {
  const { userId, slug, tool, credits, taskId, provider, body } = opts;
  // KIE.AI doesn't have its own GenerationProvider enum value — use PIAPI as
  // the routing umbrella since both flow through our PiAPI-style task handler.
  const dbProvider = "PIAPI" as const;
  const taskIdKey = provider === "KIEAI" ? "kieAiTaskId" : "piApiTaskId";

  const generation = await prisma.generation.create({
    data: {
      userId,
      workflowType: getWorkflowTypeForTool(slug),
      status: "PROCESSING",
      contentMode: "SFW",
      provider: dbProvider,
      modelId: slug,
      creditsCost: credits,
      withAudio: false,
      inputParams: {
        toolSlug: slug,
        toolName: tool.name,
        outputType: tool.outputType,
        [taskIdKey]: taskId,
        routedProvider: provider.toLowerCase(),
        submissionPath: "workshop",
        ...stripHeavyKeys(body),
      } as Prisma.InputJsonValue,
      startedAt: new Date(),
      queuedAt: new Date(),
    },
    select: { id: true },
  });

  return generation.id;
}

// ─── R2 upload helper ─────────────────────────────────────────────────────────

async function uploadBase64ToR2(userId: string, dataUrl: string): Promise<string> {
  const match = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) throw new Error("Invalid base64 data URL");
  const [, mimeType, base64] = match;
  const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const key = `users/${userId}/workshop/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(base64, "base64");
  await uploadToR2(key, buffer, mimeType);
  return getSignedR2Url(key, 7200);
}

function isBase64(v: unknown): v is string {
  return typeof v === "string" && v.startsWith("data:");
}

/** Upload a single image field if it's a base64 data URL; return signed URL or original string. */
async function resolveImg(userId: string, v: unknown): Promise<string | undefined> {
  if (!v) return undefined;
  if (isBase64(v)) return uploadBase64ToR2(userId, v);
  if (typeof v === "string") return v;
  return undefined;
}

/** Upload all base64 images in an array. */
async function resolveImgArray(userId: string, arr: unknown): Promise<string[]> {
  if (!Array.isArray(arr)) return [];
  const results = await Promise.all(arr.map((v) => resolveImg(userId, v)));
  return results.filter(Boolean) as string[];
}

// ─── Batch image-scene helper (Photodump, Headshot Generator) ─────────────────
// Submits N curated Nano Banana Pro tasks in parallel — one per scene template.
// Each task gets its OWN Generation row so the result lands in /gallery
// individually + is independently pollable via /api/workshop/poll. Linked by a
// shared batchId so the client can render a unified grid. Per-scene failures
// trigger a per-image refund — users only pay for what actually shipped.

async function submitBatchImageScenes(opts: {
  slug: string;
  tool: WorkshopTool;
  userId: string;
  credits: number;
  scenes: SceneTemplate[];
  body: Record<string, unknown>;
  perImageCredits: number;
}): Promise<NextResponse> {
  const { slug, tool, userId, credits, scenes, body, perImageCredits } = opts;

  const charUrl = await resolveImg(userId, body.characterImage);
  if (!charUrl) {
    await refundCredits(userId, credits, `Refund: ${slug} missing character image`);
    return NextResponse.json({ error: "Missing character image" }, { status: 400 });
  }

  const batchId = randomUUID();
  const batchIdKey = `${slug}BatchId`;

  const results = await Promise.all(
    scenes.map(async (scene, idx) => {
      try {
        const result = await submitTask("gemini", "nano-banana-pro", {
          prompt: scene.prompt,
          image_urls: [charUrl],
          aspect_ratio: scene.aspectRatio,
          resolution: "1K",
          output_format: "png",
        });

        const gen = await prisma.generation.create({
          data: {
            userId,
            workflowType: "TEXT_TO_IMAGE",
            status: "PROCESSING",
            contentMode: "SFW",
            provider: "PIAPI",
            modelId: slug,
            creditsCost: perImageCredits,
            withAudio: false,
            inputParams: {
              toolSlug: slug,
              toolName: tool.name,
              outputType: "image",
              [batchIdKey]: batchId,
              batchId,
              sceneSlug: scene.slug,
              sceneLabel: scene.label,
              sceneIndex: idx,
              aspectRatio: scene.aspectRatio,
              piApiTaskId: result.taskId,
              submissionPath: `workshop-${slug}`,
              prompt: scene.prompt,
            } as Prisma.InputJsonValue,
            startedAt: new Date(),
            queuedAt: new Date(),
          },
          select: { id: true },
        });

        return { ok: true as const, sceneSlug: scene.slug, sceneLabel: scene.label, sceneIndex: idx, taskId: result.taskId, generationId: gen.id };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[workshop/${slug}] scene=${scene.slug} submission failed:`, msg);
        return { ok: false as const, sceneSlug: scene.slug, sceneLabel: scene.label, sceneIndex: idx, error: msg };
      }
    }),
  );

  const succeeded = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  if (failed.length > 0) {
    await refundCredits(userId, failed.length * perImageCredits, `Refund: ${slug} ${failed.length}/${scenes.length} scenes failed to submit`);
  }

  if (succeeded.length === 0) {
    return NextResponse.json({ error: sanitizeClientError(failed[0]?.error ?? `${tool.name} submission failed`, `workshop/${slug}`) }, { status: 500 });
  }

  return NextResponse.json({
    batchId,
    // Back-compat alias for the existing Photodump client that reads photodumpBatchId
    [batchIdKey]: batchId,
    items: succeeded.map((s) => ({
      sceneSlug: s.sceneSlug,
      sceneLabel: s.sceneLabel,
      sceneIndex: s.sceneIndex,
      taskId: s.taskId,
      generationId: s.generationId,
    })),
    failedCount: failed.length,
    creditsCharged: succeeded.length * perImageCredits,
  });
}

// ─── Credit computation ───────────────────────────────────────────────────────

function computeCredits(slug: string, body: Record<string, unknown>): number {
  switch (slug) {
    case "photo-face-swap":   return 40;
    case "multi-face-swap":   return 60;
    case "video-face-swap":   return 2400;
    case "virtual-try-on":    return 280 * (Number(body.batchSize) || 1);
    case "ai-hug":            return 800;
    case "lipsync":           return 400;
    case "talking-avatar": {
      // OmniHuman 1.5: $0.13/s audio. Tiered to avoid measuring audio length client-side.
      // 75% margin: 5s→2,600 / 15s→7,800 / 30s→15,600.
      const tier = String(body.length ?? "15");
      if (tier === "5")  return 2600;
      if (tier === "30") return 15600;
      return 7800;
    }
    case "effects":           return body.professionalMode ? 1840 : 1040;
    case "kling-sound":       return 280;
    case "video-remove-bg":   return 240;
    case "watermark-remover": return 200;
    case "remove-bg":         return 10;
    case "super-resolution":  return 50;
    case "joycaption":        return 40;
    case "trellis3d":         return 400;
    case "music-gen":         return 200;
    case "song-extend":       return 200;
    case "add-audio":         return 75;
    case "diffrhythm":        return 80;
    case "character-swap":
      return 240;
    case "character-swap-remix":
      return 240 * Math.max(1, Math.min(4, Number(body.numImages ?? 1)));
    case "recraft-crisp-upscale":
      return 60;
    case "grok-video-upscale":
      return 600;
    case "topaz-image-upscale": {
      // KIE.AI Topaz Image Upscale: $0.05 / $0.10 / $0.20 per image for 2x / 4x / 8x.
      // 75% margin → 800 / 1,600 / 3,200 cr.
      const factor = Number(body.upscaleFactor ?? 2);
      if (factor === 8) return 3200;
      if (factor === 4) return 1600;
      return 800;
    }
    // ── Viral Presets ──
    case "preset-ugc-hook":         return 2000; // Kling 3.0 omni 720p, $0.10/s × 5 = $0.50 → 2000 cr (75%)
    case "preset-paparazzi-flash":  return 1300;
    case "preset-slow-mo":          return 2000;
    case "preset-magazine-cover":   return 450;
    case "preset-red-carpet":       return 2000;
    case "preset-drift-racing":     return 4000; // seedance-2-preview-vip 720p, $0.20/s × 5 = $1.00 → 4000 cr (75%)
    case "preset-cctv":             return 1600;
    case "preset-neon-city":        return 2000;
    case "preset-3d-render":        return 3200; // seedance-2-fast-preview-vip 720p, $0.16/s × 5 = $0.80 → 3200 cr (75%)
    case "preset-anime":            return 2000;
    case "preset-kung-fu":          return 2000; // Kling 3.0 omni 720p 5s
    case "preset-zombie-dance":     return 2000; // Kling 3.0 omni 720p 5s
    case "preset-dragon-fantasy":   return 2000; // Kling 3.0 omni 720p 5s
    case "preset-night-vision":     return 1600; // Wan 2.6 img2video 720p 5s
    case "preset-storm-giant":      return 2000;
    case "preset-ai-kiss":          return 2000; // Kling 3.0 omni 720p 5s — 2-person
    case "preset-ai-wedding":       return 2000;
    case "preset-ai-reunion":       return 2000;
    case "preset-ai-pet-hug":       return 2000;
    case "preset-snow-globe":       return 2000;
    case "preset-tiny-person":      return 2000;
    case "preset-disco-70s":        return 2000;
    case "preset-skydiving":        return 2000;
    case "preset-crystal-cave":     return 2000;
    case "preset-spy-mission":      return 2000;
    // Wave 22 NSFW presets — Wan 2.6 NSFW via Venice (5s 720p ≈ $0.35 / 1,700 cr)
    case "preset-boudoir-bedroom":  return 1700;
    case "preset-wet-shower":       return 1700;
    case "preset-lace-lingerie":    return 1700;
    case "preset-pool-wet-look":    return 1700;
    case "preset-silk-sheets":      return 1700;
    case "preset-vegas-penthouse":  return 1700;
    case "preset-oral":             return 1700;
    case "preset-underwater":       return 2000; // Kling 3.0 omni 720p 5s
    case "preset-vhs-90s":          return 2000;
    case "preset-catwalk":          return 2000;
    case "preset-polaroid-70s":     return 2000;
    case "preset-gym-action":       return 2000;
    case "preset-action-hero":      return 2000;
    // Photodump = 12 × Nano Banana Pro images @ ~450 cr each (75% margin on $0.105)
    case "photodump":               return 12 * 450;
    case "headshot-generator":      return 6 * 450; // 6 studio headshots @ 75% margin on Nano Banana Pro
    case "outfit-swap":             return 450;     // Single Nano Banana Pro image edit, 75% margin
    case "virality-predictor":      return 200;     // Claude Sonnet 4.6 multimodal video analysis // Kling 3.0 omni 720p 5s
    default:                  return 100;
  }
}

// ─── NSFW preset prompts (gated submission via Venice Wan 2.6 NSFW) ──────────

const NSFW_NEGATIVE = "low quality, blurry, distorted face, deformed body, deformed hands, watermark, text overlay, cartoon, anime, child, minor, underage";

const NSFW_PRESET_PROMPTS: Record<string, string> = {
  "preset-boudoir-bedroom":
    "The woman from the reference image lying back on a soft pink-toned bedroom bed dressed in elegant sheer black lingerie, relaxed sensual pose, soft window light from the side casting subtle shadows on her skin, satin sheets bunched around her legs, intimate magazine boudoir-photography aesthetic, slow gentle camera push-in. Tasteful adult sensuality, glamour-magazine production quality.",
  "preset-wet-shower":
    "The woman from the reference image standing in a luxury steam-filled shower behind frosted glass, water cascading down her bare shoulders and back, glistening wet skin, hand pressed against the wet glass, head tilted back, eyes closed, sensual intimate mood, warm tungsten bathroom lighting through the steam. Slow cinematic camera move, magazine-glamour aesthetic.",
  "preset-lace-lingerie":
    "The woman from the reference image standing in a sultry mirror-wall bedroom wearing a black lace lingerie set with matching garters. Over-the-shoulder mirror pose, warm tungsten light, hand running through her hair, sensual confident expression. Glamour-magazine production quality, slow turn toward the camera.",
  "preset-pool-wet-look":
    "The woman from the reference image emerging slowly from an infinity-edge rooftop pool at golden hour wearing a barely-there bikini, water beading on her glistening skin, wet hair dripping past her shoulders, sensual slow movement as she walks toward the camera through the water. Sunset golden light, luxury rooftop setting, cinematic glamour-photography aesthetic.",
  "preset-silk-sheets":
    "The woman from the reference image waking up wrapped only in white silk bedsheets, golden morning window light streaming across the bed, bare shoulders exposed, sleepy bed-tousled hair, sensual but tender intimate morning mood, soft slow stretching motion, draped sheet partially covering her body. Magazine-quality intimate photography.",
  "preset-vegas-penthouse":
    "The woman from the reference image in a glamorous Las Vegas penthouse suite at sunset, wearing a half-open black silk robe loosely tied at the waist, standing against floor-to-ceiling windows that look out over the Vegas strip glowing pink and gold. Sultry confident pose, head turned slightly toward camera, golden cinematic light catching her figure, slow camera glide. Editorial glamour aesthetic.",
  "preset-oral":
    "The reference image is a side-by-side composite — the LEFT half is one adult person, the RIGHT half is a different adult person. Animate an intimate scene where the LEFT person is lying back on a softly lit luxury bedroom bed receiving oral sex from the RIGHT person, who is positioned between their legs. Both adults from the reference image, both clearly adults. Focus on the LEFT person's facial expression — eyes half-closed in pleasure, lips parted, head tilted back, one hand gently in the RIGHT person's hair. Bare upper body on the LEFT person. The RIGHT person is partially visible at the bottom of frame in soft focus. Warm tungsten lighting, slow sensual camera move along the LEFT person's body, magazine-quality adult cinematic production.",
};

// Slugs that take TWO character images and feed Wan 2.6 NSFW a server-side
// side-by-side composite. Add new two-image NSFW presets here as we ship them.
const NSFW_TWO_IMAGE_SLUGS = new Set(["preset-oral"]);

async function submitNsfwPreset(opts: {
  userId: string;
  slug: string;
  tool: WorkshopTool;
  credits: number;
  body: Record<string, unknown>;
}): Promise<NextResponse> {
  const { userId, slug, tool, credits, body } = opts;

  // Resolve the reference image — single character OR composited two-character.
  let charUrl: string | undefined;
  if (NSFW_TWO_IMAGE_SLUGS.has(slug)) {
    const [p1, p2] = await Promise.all([
      resolveImg(userId, body.person1),
      resolveImg(userId, body.person2),
    ]);
    if (!p1 || !p2) {
      await refundCredits(userId, credits, `Refund: ${slug} missing character image(s)`);
      return NextResponse.json({ error: "Need both character images" }, { status: 400 });
    }
    try {
      // Composite L+R into one frame so Wan 2.6's single-image input can
      // reason about both subjects. Prompt distinguishes by position.
      charUrl = await compositeSideBySideToR2(userId, p1, p2);
    } catch (err) {
      await refundCredits(userId, credits, `Refund: ${slug} composite failed`);
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[workshop/${slug}] composite failed:`, msg);
      return NextResponse.json(
        { error: sanitizeClientError(msg, `workshop/${slug}`) },
        { status: 500 },
      );
    }
  } else {
    charUrl = await resolveImg(userId, body.characterImage);
    if (!charUrl) {
      await refundCredits(userId, credits, `Refund: ${slug} missing character image`);
      return NextResponse.json({ error: "Missing character image" }, { status: 400 });
    }
  }

  const prompt = NSFW_PRESET_PROMPTS[slug];
  if (!prompt) {
    await refundCredits(userId, credits, `Refund: ${slug} no NSFW prompt`);
    return NextResponse.json({ error: "Unknown NSFW preset" }, { status: 500 });
  }

  try {
    const result = await submitVeniceVideo({
      model: "wan-2.6-image-to-video",
      prompt,
      duration: "5s",
      resolution: "720p",
      aspectRatio: "9:16",
      audio: false,
      imageUrl: charUrl,
      negativePrompt: NSFW_NEGATIVE,
    });

    // Workshop poll handles the venice:video: prefix (see /api/workshop/poll)
    const prefixedTaskId = `venice:video:${result.model}:${result.queueId}`;

    const generation = await prisma.generation.create({
      data: {
        userId,
        workflowType: "IMAGE_TO_VIDEO",
        status: "PROCESSING",
        contentMode: "NSFW",
        provider: "VENICE",
        modelId: slug,
        creditsCost: credits,
        withAudio: false,
        durationSec: 5,
        resolution: "720p",
        inputParams: {
          toolSlug: slug,
          toolName: tool.name,
          outputType: "video",
          surface: "workshop-nsfw-preset",
          veniceQueueId: result.queueId,
          veniceModel: result.model,
          submissionPath: "workshop-nsfw",
          characterImageUrl: charUrl,
          // Don't store the raw prompt — it's curated server-side and NSFW
        } as Prisma.InputJsonValue,
        startedAt: new Date(),
        queuedAt: new Date(),
      },
      select: { id: true },
    });

    return NextResponse.json({
      taskId: prefixedTaskId,
      generationId: generation.id,
      credits,
    });
  } catch (err) {
    await refundCredits(userId, credits, `Refund: ${slug} Venice submission failed`);
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[workshop/${slug}] Venice submit failed:`, msg);
    return NextResponse.json(
      { error: sanitizeClientError(msg, `workshop/${slug}`) },
      { status: 500 },
    );
  }
}

// ─── PiAPI task builder ───────────────────────────────────────────────────────

async function buildTask(
  slug: string,
  body: Record<string, unknown>,
  userId: string
): Promise<{ model: string; taskType: string; input: Record<string, unknown> }> {

  switch (slug) {

    // ── Face & Identity ──────────────────────────────────────────────────────

    case "photo-face-swap": {
      const target = await resolveImg(userId, body.targetImage);
      const swap   = await resolveImg(userId, body.swapImage);
      if (!target || !swap) throw new Error("Missing required images");
      return {
        model: "Qubico/image-toolkit",
        taskType: "face-swap",
        input: { target_image: target, swap_image: swap },
      };
    }

    case "multi-face-swap": {
      const target = await resolveImg(userId, body.targetImage);
      const swap   = await resolveImg(userId, body.swapImage);
      if (!target || !swap) throw new Error("Missing required images");
      const input: Record<string, unknown> = { target_image: target, swap_image: swap };
      if (body.swapFacesIndex)   input.swap_faces_index   = body.swapFacesIndex;
      if (body.targetFacesIndex) input.target_faces_index = body.targetFacesIndex;
      return { model: "Qubico/image-toolkit", taskType: "face-swap", input };
    }

    case "video-face-swap": {
      const swap = await resolveImg(userId, body.swapImage);
      if (!body.targetVideoUrl || !swap) throw new Error("Missing video URL or face image");
      const input: Record<string, unknown> = {
        target_video: body.targetVideoUrl,
        swap_image: swap,
      };
      if (body.swapFacesIndex)   input.swap_faces_index   = body.swapFacesIndex;
      if (body.targetFacesIndex) input.target_faces_index = body.targetFacesIndex;
      return { model: "Qubico/video-toolkit", taskType: "face-swap", input };
    }

    case "virtual-try-on": {
      const modelImg = await resolveImg(userId, body.modelImage);
      if (!modelImg) throw new Error("Missing model image");
      const input: Record<string, unknown> = { model_input: modelImg };
      if (body.mode === "full" && body.dressImage) {
        input.dress_input = await resolveImg(userId, body.dressImage);
      } else {
        if (body.upperImage) input.upper_input = await resolveImg(userId, body.upperImage);
        if (body.lowerImage) input.lower_input = await resolveImg(userId, body.lowerImage);
      }
      if (body.batchSize && Number(body.batchSize) > 1) {
        input.batch_size = Number(body.batchSize);
      }
      return { model: "kling", taskType: "ai_try_on", input };
    }

    case "ai-hug": {
      const img = await resolveImg(userId, body.image);
      if (!img) throw new Error("Missing image");
      return {
        model: "Qubico/hug-video",
        taskType: "image_to_video",
        input: { image_url: img },
      };
    }

    // ── Video Tools ──────────────────────────────────────────────────────────

    case "talking-avatar": {
      const charImg = await resolveImg(userId, body.characterImage);
      if (!charImg) throw new Error("Missing character image");
      const audioUrl = typeof body.audioUrl === "string" ? body.audioUrl.trim() : "";
      if (!audioUrl) throw new Error("Missing audio URL");
      // Defense in depth: reject SSRF-prone audio URLs before PiAPI sees them.
      // PiAPI will download from this URL — we don't want internal-network URLs
      // making it that far. URL parse + protocol check; PiAPI hosts its own
      // network so private-IP probing wouldn't hit OUR infra, but garbage URLs
      // waste a paid generation.
      try {
        const parsed = new URL(audioUrl);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
          throw new Error("Audio URL must use http or https");
        }
      } catch (e) {
        throw new Error(e instanceof Error && e.message.startsWith("Audio URL") ? e.message : "Invalid audio URL");
      }
      const input: Record<string, unknown> = {
        image_url: charImg,
        audio_url: audioUrl,
        fast_mode: body.fastMode !== false,
      };
      if (typeof body.prompt === "string" && body.prompt.trim()) {
        input.prompt = body.prompt.trim();
      }
      return { model: "omni-human", taskType: "omni-human-1.5", input };
    }

    case "lipsync": {
      if (!body.videoUrl) throw new Error("Missing video URL");
      const input: Record<string, unknown> = { video_url: body.videoUrl };
      if (body.mode === "tts") {
        input.mode = "tts";
        input.text = body.ttsText;
        input.voice_type = body.ttsTimbre;
        if (body.ttsSpeed) input.tts_speed = body.ttsSpeed;
      } else {
        input.mode = "dubbing";
        input.audio_url = body.audioDubbingUrl;
      }
      return { model: "kling", taskType: "lip_sync", input };
    }

    case "effects": {
      const img = await resolveImg(userId, body.image);
      if (!img) throw new Error("Missing image");
      const input: Record<string, unknown> = {
        image_url: img,
        effect_scene: body.effect,
      };
      if (body.prompt)          input.prompt            = body.prompt;
      if (body.professionalMode) input.professional_mode = true;
      return { model: "kling", taskType: "effect", input };
    }

    case "kling-sound": {
      if (body.mode === "video") {
        if (!body.originTaskId) throw new Error("Missing origin task ID");
        return {
          model: "kling",
          taskType: "video_sound_effect",
          input: { origin_task_id: body.originTaskId },
        };
      }
      // text mode
      if (!body.prompt) throw new Error("Missing sound description");
      return {
        model: "kling",
        taskType: "sound_generation",
        input: {
          prompt: body.prompt,
          duration: Number(body.duration) || 10,
        },
      };
    }

    case "video-remove-bg": {
      if (!body.videoUrl) throw new Error("Missing video URL");
      const input: Record<string, unknown> = { video_url: body.videoUrl };
      if (body.invertOutput) input.invert_output = true;
      return { model: "Qubico/video-toolkit", taskType: "video-background-remove", input };
    }

    case "watermark-remover": {
      if (!body.videoUrl) throw new Error("Missing video URL");
      const input: Record<string, unknown> = { video_url: body.videoUrl };
      if (body.duration) input.duration = Number(body.duration);
      return { model: "Qubico/video-toolkit", taskType: "watermark-removal", input };
    }

    // ── Image Utilities ──────────────────────────────────────────────────────

    case "remove-bg": {
      const img = await resolveImg(userId, body.image);
      if (!img) throw new Error("Missing image");
      return {
        model: "Qubico/image-toolkit",
        taskType: "background-remove",
        input: { image: img, rmbg_model: body.rmbgModel || "RMBG-2.0" },
      };
    }

    case "super-resolution": {
      const img = await resolveImg(userId, body.image);
      if (!img) throw new Error("Missing image");
      const input: Record<string, unknown> = {
        image: img,
        scale_factor: Number(body.scale) || 2,
      };
      if (body.faceEnhance) input.face_enhance = true;
      return { model: "Qubico/image-toolkit", taskType: "image-upscale", input };
    }

    case "joycaption": {
      const img = await resolveImg(userId, body.image);
      if (!img) throw new Error("Missing image");
      return {
        model: "Qubico/joy-caption",
        taskType: "img-caption",
        input: {
          image_url: img,
          caption_type: body.promptStyle || "Descriptive",
          length: body.captionLength || "any",
        },
      };
    }

    case "trellis3d": {
      const img = await resolveImg(userId, body.image);
      if (!img) throw new Error("Missing image");
      const input: Record<string, unknown> = { image_url: img };
      if (Number(body.seed) > 0) input.seed = Number(body.seed);
      return { model: "Qubico/trellis", taskType: "image-to-3d", input };
    }

    // ── Audio & Music ────────────────────────────────────────────────────────

    case "music-gen": {
      if (!body.gptDescriptionPrompt && body.lyricsType !== "instrumental") {
        throw new Error("Missing music description");
      }
      const input: Record<string, unknown> = {
        gpt_description_prompt: body.gptDescriptionPrompt || "",
        lyrics_type: body.lyricsType || "generate",
      };
      if (body.lyricsType === "user" && body.lyrics) input.lyrics = body.lyrics;
      if (body.negativeTags) input.negative_tags = body.negativeTags;
      return { model: "udio", taskType: "generate", input };
    }

    case "song-extend": {
      if (!body.continueSongId) throw new Error("Missing song ID");
      const input: Record<string, unknown> = {
        continue_song_id: body.continueSongId,
        continue_at: Number(body.continueAt) || 30,
        prompt: body.prompt || "",
        lyrics_type: body.lyricsType || "generate",
      };
      if (body.lyricsType === "user" && body.lyrics) input.lyrics = body.lyrics;
      return { model: "udio", taskType: "extend", input };
    }

    case "add-audio": {
      if (!body.videoUrl || !body.prompt) throw new Error("Missing video URL or audio description");
      const input: Record<string, unknown> = {
        video_url: body.videoUrl,
        prompt: body.prompt,
        steps: Number(body.steps) || 25,
      };
      if (body.negativePrompt) input.negative_prompt = body.negativePrompt;
      return { model: "Qubico/mmaudio", taskType: "video-to-audio", input };
    }

    case "diffrhythm": {
      if (!body.lyrics || !body.stylePrompt) throw new Error("Missing lyrics or style description");
      const input: Record<string, unknown> = {
        lyrics: body.lyrics,
        style_prompt: body.stylePrompt,
      };
      if (body.styleAudioUrl) input.style_audio_url = body.styleAudioUrl;
      return {
        model: "diffrhythm",
        taskType: String(body.taskType || "txt2audio-base"),
        input,
      };
    }

    // ── Viral Presets ──────────────────────────────────────────────────────
    // Each preset is a curated configuration of an existing video/image model.
    // Templates have a single {description}/{outfit}/{action}/{style} slot
    // when the form provides one; otherwise the prompt is fully baked.

    case "preset-ugc-hook": {
      const charImg = await resolveImg(userId, body.characterImage);
      const productImg = await resolveImg(userId, body.productImage);
      if (!charImg) throw new Error("Missing character image");
      if (!productImg) throw new Error("Missing product image");
      const description = (typeof body.description === "string" ? body.description.trim() : "") || "casually demonstrating the product with a genuine excited reveal";
      const prompt = `@image_1 The creator from the first reference image holding and showing @image_2 (the product) — ${description}. Authentic UGC-style phone video: natural handheld phone camera with subtle shake, soft window lighting, casual home or office setting, genuine emotional reaction, phone-quality realism (NOT cinematic). Direct-to-camera framing typical of viral TikTok creator content.`;
      return {
        model: "kling",
        taskType: "omni_video_generation",
        input: {
          prompt,
          images: [charImg, productImg],
          duration: 5,
          aspect_ratio: "9:16",
          resolution: "720p",
          version: "3.0",
        },
      };
    }

    case "preset-paparazzi-flash": {
      const img = await resolveImg(userId, body.characterImage);
      if (!img) throw new Error("Missing character image");
      const outfit = (typeof body.outfit === "string" ? body.outfit.trim() : "") || "stylish evening attire";
      const prompt = `Candid paparazzi-style video of the person walking quickly through a crowd at night, wearing ${outfit}. Multiple bright camera flashes firing rapidly from both sides, heavy motion blur on the flashes, grainy 2000s celebrity tabloid film aesthetic, raw urban street energy, photographers calling out. Handheld documentary feel.`;
      return {
        model: "kling",
        taskType: "video_generation",
        input: {
          prompt,
          image_url: img,
          duration: 5,
          aspect_ratio: "9:16",
          version: "2.6",
          mode: "pro",
        },
      };
    }

    case "preset-slow-mo": {
      const img = await resolveImg(userId, body.characterImage);
      if (!img) throw new Error("Missing character image");
      const action = (typeof body.action === "string" ? body.action.trim() : "");
      if (!action) throw new Error("Action description is required");
      const prompt = `@image_1 Hyper-realistic slow-motion shot of the person ${action}. 1000fps cinematic capture, extreme motion detail, dramatic side-lit composition, shallow depth of field, fluid motion physics. Sweat droplets, hair, and clothing movement visible. Action-movie quality.`;
      return {
        model: "kling",
        taskType: "omni_video_generation",
        input: {
          prompt,
          images: [img],
          duration: 5,
          aspect_ratio: "9:16",
          resolution: "720p",
          version: "3.0",
        },
      };
    }

    case "preset-magazine-cover": {
      const img = await resolveImg(userId, body.characterImage);
      if (!img) throw new Error("Missing character image");
      const style = (typeof body.style === "string" ? body.style.trim() : "") || "high-fashion";
      const prompt = `Premium ${style} editorial magazine cover photograph of the person from the reference image. Dramatic studio lighting with a single key light, glossy production quality, sharp focus on the face, soft seamless background, magazine-cover composition with negative space at the top for masthead text. Vogue / GQ-level quality, color-graded for print.`;
      return {
        model: "gemini",
        taskType: "nano-banana-pro",
        input: {
          prompt,
          image_urls: [img],
          output_format: "png",
          aspect_ratio: "3:4",
        },
      };
    }

    case "outfit-swap": {
      const charImg = await resolveImg(userId, body.characterImage);
      const outfitImg = await resolveImg(userId, body.outfitImage);
      if (!charImg) throw new Error("Missing character image");
      if (!outfitImg) throw new Error("Missing outfit image");
      const notes = (typeof body.notes === "string" ? body.notes.trim() : "");
      const stylingClause = notes ? ` Styling notes: ${notes}.` : "";
      const prompt = `The first reference image is the person. The second reference image shows the outfit. Replace the clothing on the person from the first image with the exact outfit shown in the second image — same garments, same colors, same style, same fabric details. Keep the person's face, hair, skin tone, body shape, pose, and entire background exactly as they appear in the first image. The outfit should look naturally fitted to their body, with realistic fabric drape, seams, and shadows. Photorealistic editorial quality.${stylingClause}`;
      return {
        model: "gemini",
        taskType: "nano-banana-pro",
        input: {
          prompt,
          image_urls: [charImg, outfitImg],
          output_format: "png",
          aspect_ratio: "3:4",
        },
      };
    }

    case "preset-red-carpet": {
      const img = await resolveImg(userId, body.characterImage);
      if (!img) throw new Error("Missing character image");
      const prompt = `@image_1 The person walking confidently on a glamorous red carpet at a film premiere. Rapid paparazzi camera flashes firing from both sides of frame, elegant formal evening wear, slow confident walk toward camera, warm golden cinematic key lighting, Hollywood premiere atmosphere, slight motion blur on each flash burst. Smooth dolly tracking shot.`;
      return {
        model: "kling",
        taskType: "omni_video_generation",
        input: {
          prompt,
          images: [img],
          duration: 5,
          aspect_ratio: "9:16",
          resolution: "720p",
          version: "3.0",
        },
      };
    }

    case "preset-drift-racing": {
      const charImg = await resolveImg(userId, body.characterImage);
      if (!charImg) throw new Error("Missing character image");
      const carImg = await resolveImg(userId, body.carImage);
      const carText = (typeof body.car === "string" ? body.car.trim() : "");
      // Reference car image wins over text description. Falls back to default
      // copy when neither is provided.
      const carPhrase = carImg
        ? "the car shown in the second reference image"
        : `a ${carText || "matte-black tuned sports car"}`;
      const imageRefs = carImg ? [charImg, carImg] : [charImg];
      const prompt = `High-energy cinematic drift sequence of the person from the first reference image driving ${carPhrase} at night on a wet city street. Aggressive controlled slide with thick tire smoke billowing, intense motion blur, dramatic low-angle and over-the-shoulder camera angles, neon street reflections, action-film color grading, shaky-cam energy. The driver is visible through the windshield, focused and intense.`;
      // VIP variant needed for true 720p output (non-VIP locks to 480p).
      return {
        model: "seedance",
        taskType: "seedance-2-preview-vip",
        input: {
          prompt,
          image_urls: imageRefs,
          duration: 5,
          aspect_ratio: "9:16",
          resolution: "720p",
        },
      };
    }

    case "preset-cctv": {
      const img = await resolveImg(userId, body.characterImage);
      if (!img) throw new Error("Missing character image");
      const scene = (typeof body.scene === "string" ? body.scene.trim() : "");
      if (!scene) throw new Error("Scene description is required");
      const prompt = `Grainy black-and-white surveillance CCTV camera footage. The person is ${scene}. Fixed high-angle camera mount, slight fisheye distortion, low frame rate stutter, timestamp burned into the top-right corner reading "CAM 04 — 02:47:13", dim ambient lighting, vignette in the corners, slight tape-noise grain. Uncanny found-footage feel.`;
      return {
        model: "Wan",
        taskType: "wan26-img2video",
        input: {
          prompt,
          image_url: img,
          duration: 5,
          aspect_ratio: "16:9",
          resolution: "720P",
        },
      };
    }

    case "preset-neon-city": {
      const img = await resolveImg(userId, body.characterImage);
      if (!img) throw new Error("Missing character image");
      const prompt = `@image_1 The person walking slowly through a rain-soaked cyberpunk neon-lit street at night. Tall glowing pink and cyan billboards reflecting off wet pavement, atmospheric haze, gentle wind moving hair and clothing, Blade Runner-grade cinematic lighting, shallow depth of field, slow dolly tracking shot. Moody, contemplative pacing.`;
      return {
        model: "kling",
        taskType: "omni_video_generation",
        input: {
          prompt,
          images: [img],
          duration: 5,
          aspect_ratio: "9:16",
          resolution: "720p",
          version: "3.0",
        },
      };
    }

    case "preset-3d-render": {
      const img = await resolveImg(userId, body.characterImage);
      if (!img) throw new Error("Missing character image");
      const prompt = `Stylized 3D-animated character render of the person from the reference image — Pixar/DreamWorks/Disney-style. Soft subsurface skin shading, expressive proportions with slightly enlarged eyes, polished animated-film quality, warm cinematic key light, soft background bokeh. Subtle idle animation: gentle smile, slight head tilt, blinking. Polished animation-studio finish.`;
      // VIP variant needed for true 720p output (non-VIP locks to 480p).
      return {
        model: "seedance",
        taskType: "seedance-2-fast-preview-vip",
        input: {
          prompt,
          image_urls: [img],
          duration: 5,
          aspect_ratio: "1:1",
          resolution: "720p",
        },
      };
    }

    case "preset-anime": {
      const img = await resolveImg(userId, body.characterImage);
      if (!img) throw new Error("Missing character image");
      const prompt = `@image_1 The person reimagined as a high-quality anime character in the style of a modern cinematic anime film (Makoto Shinkai / Studio Trigger aesthetic). Dramatic transformation moment: dynamic pose, glowing energy particles, motion lines streaking behind them, vibrant color palette, cel-shaded lighting, sparkles. Camera pushes in slowly.`;
      return {
        model: "kling",
        taskType: "omni_video_generation",
        input: {
          prompt,
          images: [img],
          duration: 5,
          aspect_ratio: "9:16",
          resolution: "720p",
          version: "3.0",
        },
      };
    }

    case "preset-kung-fu": {
      const img = await resolveImg(userId, body.characterImage);
      if (!img) throw new Error("Missing character image");
      const action = (typeof body.action === "string" ? body.action.trim() : "") || "an explosive spin kick combo";
      const prompt = `@image_1 The fighter from the reference image executing ${action} — dynamic martial-arts action shot. Dramatic motion blur on the limbs, swirling dust and sparks on impact, low-angle hero shot, action-film color grading, cinematic golden-hour key light, tight choreography energy. Wu xia / shonen sensibility.`;
      return {
        model: "kling",
        taskType: "omni_video_generation",
        input: {
          prompt,
          images: [img],
          duration: 5,
          aspect_ratio: "9:16",
          resolution: "720p",
          version: "3.0",
        },
      };
    }

    case "preset-zombie-dance": {
      const img = await resolveImg(userId, body.characterImage);
      if (!img) throw new Error("Missing character image");
      const prompt = `@image_1 The person reimagined as a stylized zombie performing a Thriller-style choreographed dance routine. Pale grey-green skin, tattered formal clothing, glowing yellow-amber eyes, fog-shrouded graveyard at night, gravestones and bare trees in the background, dramatic moonlight from above, fluid synchronized horror-pop choreography. Cinematic Halloween viral aesthetic.`;
      return {
        model: "kling",
        taskType: "omni_video_generation",
        input: {
          prompt,
          images: [img],
          duration: 5,
          aspect_ratio: "9:16",
          resolution: "720p",
          version: "3.0",
        },
      };
    }

    case "preset-dragon-fantasy": {
      const img = await resolveImg(userId, body.characterImage);
      if (!img) throw new Error("Missing character image");
      const prompt = `@image_1 The person standing heroically before a massive ancient dragon. Misty mountain valley at dawn, the dragon's scaled body coiled behind them with glowing embers drifting from its nostrils, cloak gently blowing in the wind, sword or staff in hand, sweeping cinematic camera move that reveals the dragon's full scale. Epic fantasy-film quality, deep cinematic color grading, mythic atmospheric haze.`;
      return {
        model: "kling",
        taskType: "omni_video_generation",
        input: {
          prompt,
          images: [img],
          duration: 5,
          aspect_ratio: "16:9",
          resolution: "720p",
          version: "3.0",
        },
      };
    }

    case "preset-night-vision": {
      const img = await resolveImg(userId, body.characterImage);
      if (!img) throw new Error("Missing character image");
      const scene = (typeof body.scene === "string" ? body.scene.trim() : "");
      if (!scene) throw new Error("Scene description is required");
      const prompt = `Grainy military-grade night-vision surveillance footage. The person from the reference image ${scene}. Monochromatic green tint throughout, slight image noise and scanlines, low-light tactical aesthetic, faint white reticle / corner HUD elements, occasional distant heat-blob silhouettes, surveillance camera POV with slight handheld jitter.`;
      return {
        model: "Wan",
        taskType: "wan26-img2video",
        input: {
          prompt,
          image_url: img,
          duration: 5,
          aspect_ratio: "16:9",
          resolution: "720P",
        },
      };
    }

    case "preset-storm-giant": {
      const img = await resolveImg(userId, body.characterImage);
      if (!img) throw new Error("Missing character image");
      const prompt = `@image_1 The person transforming into a colossal storm giant — towering above swirling stormy clouds. Their body composed of dense storm clouds and crackling blue-white lightning, eyes glowing electric, arms outstretched commanding the elements, dramatic wind and torrential rain streaming around them, cinematic mythological scale, epic god-of-thunder aesthetic. Camera pulls back to reveal their massive size.`;
      return {
        model: "kling",
        taskType: "omni_video_generation",
        input: {
          prompt,
          images: [img],
          duration: 5,
          aspect_ratio: "9:16",
          resolution: "720p",
          version: "3.0",
        },
      };
    }

    case "preset-ai-kiss": {
      const [img1, img2] = await Promise.all([
        resolveImg(userId, body.person1),
        resolveImg(userId, body.person2),
      ]);
      if (!img1 || !img2) throw new Error("Missing person image(s)");
      const prompt = `@image_1 @image_2 The two people from the reference images sharing a tender, slow cinematic kiss at sunset. Soft warm backlit golden-hour glow, gentle wind in their hair, dreamy shallow depth of field, dramatic slow camera push-in toward their faces. Romantic film aesthetic, lens-flare highlights, tasteful and sweet. Keep both faces clearly recognizable as the people from the reference images.`;
      return {
        model: "kling",
        taskType: "omni_video_generation",
        input: { prompt, images: [img1, img2], duration: 5, aspect_ratio: "9:16", resolution: "720p", version: "3.0" },
      };
    }

    case "preset-ai-wedding": {
      const [img1, img2] = await Promise.all([
        resolveImg(userId, body.person1),
        resolveImg(userId, body.person2),
      ]);
      if (!img1 || !img2) throw new Error("Missing person image(s)");
      const prompt = `@image_1 @image_2 The two people from the reference images on their wedding day — a first-look reaction moment in a sun-drenched garden ceremony venue. One in a flowing white wedding dress, one in an elegant tailored suit, exchanging emotional eye contact then embracing. White floral arrangements behind them, golden-hour cinematic light, magazine-cover styling, slow elegant camera move. Keep both faces clearly recognizable as the people from the references.`;
      return {
        model: "kling",
        taskType: "omni_video_generation",
        input: { prompt, images: [img1, img2], duration: 5, aspect_ratio: "9:16", resolution: "720p", version: "3.0" },
      };
    }

    case "preset-ai-reunion": {
      const [img1, img2] = await Promise.all([
        resolveImg(userId, body.person1),
        resolveImg(userId, body.person2),
      ]);
      if (!img1 || !img2) throw new Error("Missing person image(s)");
      const prompt = `@image_1 @image_2 The two people from the reference images sharing an emotional reunion embrace at an airport terminal. They run into each other's arms in slow motion, joyful happy tears, broad smiles, soft backlit airport-window light streaming behind them, blurred travelers in the background, hand luggage forgotten beside them. Movie-trailer emotional quality, cinematic slow-mo, warm color grade. Keep both faces clearly recognizable as the people from the references.`;
      return {
        model: "kling",
        taskType: "omni_video_generation",
        input: { prompt, images: [img1, img2], duration: 5, aspect_ratio: "9:16", resolution: "720p", version: "3.0" },
      };
    }

    case "preset-ai-pet-hug": {
      const [personImg, petImg] = await Promise.all([
        resolveImg(userId, body.person1),
        resolveImg(userId, body.person2),
      ]);
      if (!personImg || !petImg) throw new Error("Missing image(s) — need both your photo and your pet's photo");
      const prompt = `@image_1 (the person) gently embracing @image_2 (the pet/animal) in a heartwarming family-pet moment. Warm golden-hour soft window light streaming behind them, the person's hand stroking the pet's fur, peaceful contented expression on both, the pet leaning into the embrace, slow cinematic camera push-in toward their faces, gentle natural motion. Tender emotional moment, the kind of clip that goes viral on pet-tok. Keep the person's face and the pet's distinctive features (color, breed, markings) clearly recognizable from the references.`;
      return {
        model: "kling",
        taskType: "omni_video_generation",
        input: { prompt, images: [personImg, petImg], duration: 5, aspect_ratio: "9:16", resolution: "720p", version: "3.0" },
      };
    }

    case "preset-snow-globe": {
      const img = await resolveImg(userId, body.characterImage);
      if (!img) throw new Error("Missing character image");
      const prompt = `@image_1 The person from the reference image standing inside a magical glass snow globe — they're miniaturized within the dome, soft white snowflakes gently drifting around them, a tiny cozy winter-village backdrop behind them with miniature houses and pine trees, warm golden lantern glow, the curved glass of the snow globe subtly visible at the edges of frame catching highlights. Whimsical winter-wonderland aesthetic, Christmas-window-display magic, slow gentle camera move.`;
      return {
        model: "kling", taskType: "omni_video_generation",
        input: { prompt, images: [img], duration: 5, aspect_ratio: "9:16", resolution: "720p", version: "3.0" },
      };
    }

    case "preset-tiny-person": {
      const img = await resolveImg(userId, body.characterImage);
      if (!img) throw new Error("Missing character image");
      const prompt = `@image_1 The person from the reference image shrunk down to a tiny 3-inch miniature scale standing on a wooden kitchen tabletop next to a comically oversized coffee mug that towers above them. Soft natural morning window light from the side, gentle steam rising from the coffee, tilt-shift toy-photography aesthetic with shallow depth of field, the person walking around the tabletop in slow motion looking up at the giant mug in awe. Whimsical viral-tiktok scale-shift composition.`;
      return {
        model: "kling", taskType: "omni_video_generation",
        input: { prompt, images: [img], duration: 5, aspect_ratio: "9:16", resolution: "720p", version: "3.0" },
      };
    }

    case "preset-disco-70s": {
      const img = await resolveImg(userId, body.characterImage);
      if (!img) throw new Error("Missing character image");
      const prompt = `@image_1 The person from the reference image dancing on a 1970s disco dance floor — a glittering mirror ball overhead throws spinning rainbow light spots across the room, multicolored strobe lights flash from below, the floor itself is lit-up multicolored squares. Bell-bottoms-era styling, groovy hip-swaying dance move, lens flares from the strobes, vintage disco-film color grade. The crowd is blurred and energetic behind them.`;
      return {
        model: "kling", taskType: "omni_video_generation",
        input: { prompt, images: [img], duration: 5, aspect_ratio: "9:16", resolution: "720p", version: "3.0" },
      };
    }

    case "preset-skydiving": {
      const img = await resolveImg(userId, body.characterImage);
      if (!img) throw new Error("Missing character image");
      const prompt = `@image_1 The person from the reference image in mid-freefall above a vast cloud sea at sunrise. Their hair and clothing whipping dramatically in the wind, arms outstretched in the classic belly-to-earth skydiving pose, GoPro-style chest-mounted action camera angle showing their face and the curve of the earth far below. Bright orange-and-red parachute deploying just behind them. Extreme-sports cinematic energy, vivid blue sky, exhilarated expression.`;
      return {
        model: "kling", taskType: "omni_video_generation",
        input: { prompt, images: [img], duration: 5, aspect_ratio: "9:16", resolution: "720p", version: "3.0" },
      };
    }

    case "preset-crystal-cave": {
      const img = await resolveImg(userId, body.characterImage);
      if (!img) throw new Error("Missing character image");
      const prompt = `@image_1 The person from the reference image exploring a mystical underground crystal cavern. Towering amethyst and quartz formations everywhere glowing from within in ethereal violet and teal hues, atmospheric particulate haze catching the magical light, a gentle slow camera push-in revealing the awe on their face, hand reaching out to touch a glowing crystal, distant water-drip echoes. Fantasy-film cinematic quality, Lord-of-the-Rings mines-of-Moria aesthetic.`;
      return {
        model: "kling", taskType: "omni_video_generation",
        input: { prompt, images: [img], duration: 5, aspect_ratio: "9:16", resolution: "720p", version: "3.0" },
      };
    }

    case "preset-spy-mission": {
      const img = await resolveImg(userId, body.characterImage);
      if (!img) throw new Error("Missing character image");
      const prompt = `@image_1 The person from the reference image moving stealthily through a high-tech corridor as an action-movie spy. The space is crisscrossed with red laser security grids that they're carefully ducking and weaving between, tactical black wardrobe, intense focused expression, low-angle hero shot, dramatic side-lit emergency lighting casting deep shadows, sweat-on-brow tension. Bond-film cinematic quality, slow-motion calculated movements, mission-impossible energy.`;
      return {
        model: "kling", taskType: "omni_video_generation",
        input: { prompt, images: [img], duration: 5, aspect_ratio: "9:16", resolution: "720p", version: "3.0" },
      };
    }

    case "preset-underwater": {
      const img = await resolveImg(userId, body.characterImage);
      if (!img) throw new Error("Missing character image");
      const prompt = `@image_1 The person from the reference image suspended in an ethereal cinematic underwater scene. Crystal-blue ocean depths, beams of sunlight streaming down from the surface above creating dappled god-rays, their hair gently floating around them, dreamy slow drifting motion, soft bubbles rising past them, casual flowing clothing billowing slightly. Cinematic blue-cyan color palette, depth-of-field shallow focus, otherworldly dream-like atmosphere.`;
      return {
        model: "kling", taskType: "omni_video_generation",
        input: { prompt, images: [img], duration: 5, aspect_ratio: "9:16", resolution: "720p", version: "3.0" },
      };
    }

    case "preset-vhs-90s": {
      const img = await resolveImg(userId, body.characterImage);
      if (!img) throw new Error("Missing character image");
      const prompt = `@image_1 The person from the reference image performing in a retro 90s music-video aesthetic. Visible VHS scan lines and slight tape grain across the frame, subtle chromatic-aberration color bleed on edges, neon back-light (pink and cyan), MTV-style fast cuts and camera moves, oversized 90s streetwear styling, confident music-video energy. Slight vintage CRT-screen vignette.`;
      return {
        model: "kling", taskType: "omni_video_generation",
        input: { prompt, images: [img], duration: 5, aspect_ratio: "9:16", resolution: "720p", version: "3.0" },
      };
    }

    case "preset-catwalk": {
      const img = await resolveImg(userId, body.characterImage);
      if (!img) throw new Error("Missing character image");
      const prompt = `@image_1 The person from the reference image walking confidently down a high-fashion runway, slow-motion strut directly toward the camera. Glamorous flashing photographer lights firing on both sides creating dramatic lens flares, sleek dark backstage backdrop, dramatic side-key spotlight on them, premium designer wardrobe styling, intense focused gaze, Vogue-fashion-week aesthetic. Cinematic shallow depth of field.`;
      return {
        model: "kling", taskType: "omni_video_generation",
        input: { prompt, images: [img], duration: 5, aspect_ratio: "9:16", resolution: "720p", version: "3.0" },
      };
    }

    case "preset-polaroid-70s": {
      const img = await resolveImg(userId, body.characterImage);
      if (!img) throw new Error("Missing character image");
      const prompt = `@image_1 The person from the reference image in a warm vintage 1970s instant-camera aesthetic — sun-faded earthy color palette, subtle film grain, soft warm sunlight from a low window, retro 70s casual styling (denim, knitwear, vintage accessories), candid relaxed half-smile in a warm wood-paneled interior. Polaroid SX-70 photo-album look, slight chromatic shift, nostalgic warmth.`;
      return {
        model: "kling", taskType: "omni_video_generation",
        input: { prompt, images: [img], duration: 5, aspect_ratio: "9:16", resolution: "720p", version: "3.0" },
      };
    }

    case "preset-gym-action": {
      const img = await resolveImg(userId, body.characterImage);
      if (!img) throw new Error("Missing character image");
      const prompt = `@image_1 The person from the reference image at the apex of a dramatic heavy lift in a dimly-lit industrial gym. Dramatic side-rim lighting carving out their silhouette, chalk dust suspended in the air around them, athletic technical wear (compression top, lifting belt), focused intense expression, beads of sweat catching the light, slow-motion controlled effort. Athletic-sponsor commercial energy, magazine-cover fitness photography quality.`;
      return {
        model: "kling", taskType: "omni_video_generation",
        input: { prompt, images: [img], duration: 5, aspect_ratio: "9:16", resolution: "720p", version: "3.0" },
      };
    }

    case "preset-action-hero": {
      const img = await resolveImg(userId, body.characterImage);
      if (!img) throw new Error("Missing character image");
      const prompt = `@image_1 The person from the reference image as the cinematic action-movie hero — walking calmly and confidently directly toward the camera while a massive orange-and-black fireball explosion erupts behind them, debris and sparks suspended in the air, dust kicked up around their feet. Slow-motion confident swagger, intense focused expression, tactical wardrobe, summer-blockbuster movie-poster composition, cinematic teal-and-orange color grade.`;
      return {
        model: "kling", taskType: "omni_video_generation",
        input: { prompt, images: [img], duration: 5, aspect_ratio: "9:16", resolution: "720p", version: "3.0" },
      };
    }

    default:
      throw new Error(`Unknown tool: ${slug}`);
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tool: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const { tool: slug } = await params;
  const tool = getToolBySlug(slug);
  if (!tool) {
    return NextResponse.json({ error: "Unknown tool" }, { status: 404 });
  }

  // NSFW gate — defense in depth. The /workshop page already hides NSFW tools
  // from ineligible users, but the POST handler MUST re-check in case a user
  // crafted a direct API request. Both contentMode=NSFW AND tier!=FREE required.
  if (tool.nsfw) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { contentMode: true, subscriptionTier: true },
    });
    const eligible =
      user?.contentMode === "NSFW" &&
      user?.subscriptionTier !== "FREE" &&
      user?.subscriptionTier !== undefined;
    if (!eligible) {
      return NextResponse.json(
        {
          error:
            user?.contentMode !== "NSFW"
              ? "Enable NSFW content mode in Settings to use this preset."
              : "NSFW presets require the Starter plan or higher.",
        },
        { status: 403 },
      );
    }
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const credits = computeCredits(slug, body);

  // Deduct credits before submission
  const ok = await deductCredits(userId, credits, `Workshop: ${tool.name}`);
  if (!ok) {
    return NextResponse.json({ error: "Insufficient credits" }, { status: 402 });
  }

  // ── Character Swap — Nano Banana 2 via PiAPI ──
  if (slug === "character-swap") {
    const [targetUrl, charUrl] = await Promise.all([
      resolveImg(userId, body.targetImage),
      resolveImg(userId, body.characterImage),
    ]);
    if (!targetUrl || !charUrl) {
      await refundCredits(userId, credits, `Refund: ${slug} missing images`);
      return NextResponse.json({ error: "Missing target or character image" }, { status: 400 });
    }

    const aspectRatioMap: Record<string, string> = {
      portrait_4_3:   "3:4",
      portrait_16_9:  "9:16",
      square_hd:      "1:1",
      landscape_4_3:  "4:3",
      landscape_16_9: "16:9",
    };
    const aspectRatio = aspectRatioMap[body.imageSize as string] ?? "1:1";

    let taskId: string;
    try {
      const swapMode = body.swapMode === "face" ? "face" : "full";
      const prompt = swapMode === "face"
        ? "The first image is the target scene. The second image is the character reference. Keep everything from the first image exactly as-is — background, body, clothing, pose, and environment — but replace only the face and hair of the person with the face and hair from the second image. Do not change any clothing, body shape, or background."
        : "The first image is the target scene. The second image is the character reference. Keep the background, environment, lighting, and spatial perspective from the first image exactly as they appear. Replace the person in the first image entirely with the person from the second image — including their face, hair, body, and clothing. Maintain the original pose and scene composition.";
      const result = await submitTask("gemini", "nano-banana-2", {
        prompt,
        image_urls: [targetUrl, charUrl],
        aspect_ratio: aspectRatio,
        resolution: "1K",
        output_format: "png",
      });
      taskId = result.taskId;
    } catch (err) {
      await refundCredits(userId, credits, `Refund: ${slug} submission failed`);
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[workshop/${slug}] Nano Banana submission failed:`, msg);
      return NextResponse.json({ error: sanitizeClientError(msg, `workshop/${slug}`) }, { status: 500 });
    }

    const generationId = await createWorkshopGeneration({
      userId, slug, tool, credits, taskId, provider: "PIAPI", body,
    });
    return NextResponse.json({ taskId, generationId, credits });
  }

  // ── Virality Predictor (synchronous Claude analysis) ──
  if (slug === "virality-predictor") {
    const videoUrl = typeof body.videoUrl === "string" ? body.videoUrl.trim() : "";
    if (!videoUrl) {
      await refundCredits(userId, credits, `Refund: virality-predictor missing video`);
      return NextResponse.json({ error: "Missing video" }, { status: 400 });
    }

    const generation = await prisma.generation.create({
      data: {
        userId,
        workflowType: "IMAGE_EDIT",
        status: "PROCESSING",
        contentMode: "SFW",
        provider: "PIAPI", // No enum value for Anthropic — PIAPI as catch-all
        modelId: "virality-predictor",
        creditsCost: credits,
        withAudio: false,
        inputParams: {
          toolSlug: slug,
          toolName: tool.name,
          outputType: "text",
          videoUrl,
          submissionPath: "workshop-virality",
        } as Prisma.InputJsonValue,
        startedAt: new Date(),
        queuedAt: new Date(),
      },
      select: { id: true },
    });

    try {
      // SSRF-hardened fetch: rejects private/loopback/link-local targets
      // (incl. cloud-metadata 169.254.169.254 and Railway internal hosts),
      // re-validates redirects, caps payload at 100 MB to prevent OOM.
      const videoBuffer = await safeFetchUserUrl(videoUrl, { maxBytes: 100 * 1024 * 1024 });

      const score = await analyzeVirality(videoBuffer);

      await prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: "COMPLETED",
          progress: 100,
          completedAt: new Date(),
          inputParams: {
            toolSlug: slug,
            toolName: tool.name,
            outputType: "text",
            videoUrl,
            submissionPath: "workshop-virality",
            textOutput: JSON.stringify(score),
            viralityScore: score as unknown as Prisma.InputJsonValue,
          } as Prisma.InputJsonValue,
        },
      });

      return NextResponse.json({
        sync: true,
        generationId: generation.id,
        credits,
        result: score,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[workshop/virality-predictor] analysis failed:`, msg);
      await refundCredits(userId, credits, `Refund: virality-predictor analysis failed`);
      await prisma.generation.update({
        where: { id: generation.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          errorMessage: sanitizeClientError(msg, "workshop/virality-predictor"),
        },
      }).catch(() => {});
      return NextResponse.json({ error: sanitizeClientError(msg, "workshop/virality-predictor") }, { status: 500 });
    }
  }

  // ── NSFW preset (Venice Wan 2.6 NSFW) — single submission, gated above ──
  if (tool.nsfw) {
    return submitNsfwPreset({ userId, slug, tool, credits, body });
  }

  // ── Multi-image batch presets (Photodump, Headshot Generator) ──
  if (slug === "photodump") {
    return submitBatchImageScenes({
      slug,
      tool,
      userId,
      credits,
      scenes: PHOTODUMP_SCENES,
      body,
      perImageCredits: 450,
    });
  }
  if (slug === "headshot-generator") {
    return submitBatchImageScenes({
      slug,
      tool,
      userId,
      credits,
      scenes: HEADSHOT_SCENES,
      body,
      perImageCredits: 450,
    });
  }

  // ── KIE.AI tools (ideogram-remix, recraft, grok) ──
  const kieAiTools = ["character-swap-remix", "recraft-crisp-upscale", "grok-video-upscale", "topaz-image-upscale"];
  if (kieAiTools.includes(slug)) {
    const callbackUrl = `${process.env.APP_URL ?? "https://artifacial.app"}/api/webhooks/kieai`;
    let kieTaskId: string;
    const isImageOutput = slug !== "grok-video-upscale";

    try {
      console.log(`[workshop/${slug}] starting KIE.AI submission, body keys:`, Object.keys(body));
      if (slug === "character-swap-remix") {
        const [srcUrl, refUrl] = await Promise.all([
          resolveImg(userId, body.sourceImage),
          resolveImg(userId, body.referenceImage),
        ]);
        if (!srcUrl || !refUrl) throw new Error("Missing source or reference image");
        const result = await submitIdeogramCharacterRemix({
          imageUrl: srcUrl,
          referenceImageUrl: refUrl,
          prompt: body.prompt as string,
          strength: body.strength ? Number(body.strength) : undefined,
          style: body.style as "AUTO" | "REALISTIC" | "FICTION" | undefined,
          renderingSpeed: body.renderingSpeed as "TURBO" | "BALANCED" | "QUALITY" | undefined,
          imageSize: body.imageSize as string | undefined,
          numImages: body.numImages ? Number(body.numImages) : 1,
          seed: body.seed ? Number(body.seed) : undefined,
          negativePrompt: body.negativePrompt as string | undefined,
          expandPrompt: body.expandPrompt as boolean | undefined,
          callbackUrl,
        });
        kieTaskId = result.taskId;
      } else if (slug === "recraft-crisp-upscale") {
        const imageUrl = await resolveImg(userId, body.image);
        if (!imageUrl) throw new Error("Missing image");
        const result = await submitRecraftCrispUpscale({ imageUrl, callbackUrl });
        kieTaskId = result.taskId;
      } else if (slug === "topaz-image-upscale") {
        const imageUrl = await resolveImg(userId, body.image);
        if (!imageUrl) throw new Error("Missing image");
        const factorRaw = Number(body.upscaleFactor ?? 2);
        const upscaleFactor = (factorRaw === 4 || factorRaw === 8 ? factorRaw : 2) as 2 | 4 | 8;
        const result = await submitTopazImageUpscale({ imageUrl, upscaleFactor, callbackUrl });
        kieTaskId = result.taskId;
      } else { // grok-video-upscale
        if (!body.sourceTaskId) throw new Error("Missing source task ID");
        const result = await submitGrokVideoUpscale({
          sourceTaskId: body.sourceTaskId as string,
          callbackUrl,
        });
        kieTaskId = result.taskId;
      }
    } catch (err) {
      await refundCredits(userId, credits, `Refund: ${slug} submission failed`);
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[workshop/${slug}] KIE.AI submission failed:`, msg);
      return NextResponse.json({ error: sanitizeClientError(msg, `workshop/${slug}`) }, { status: 500 });
    }

    const prefix = isImageOutput ? "kieai:image:" : "kieai:video:";
    const prefixedTaskId = `${prefix}${kieTaskId}`;
    const generationId = await createWorkshopGeneration({
      userId, slug, tool, credits, taskId: prefixedTaskId, provider: "KIEAI", body,
    });
    return NextResponse.json({ taskId: prefixedTaskId, generationId, credits });
  }

  let taskId: string;
  let routedProvider: "kieai" | "piapi" | undefined;
  try {
    const task = await buildTask(slug, body, userId);

    // Provider routing — intercept Kling 3.0 Omni requests and prefer KIE.AI
    // (30% cheaper at 720p). Falls back to PiAPI automatically on KIE error.
    const klingRouted = detectKling3Omni(task);
    if (klingRouted) {
      const routed = await submitKling3OmniRouted(klingRouted);
      taskId = routed.taskId;
      routedProvider = routed.provider;
    } else {
      const result = await submitTask(task.model, task.taskType, task.input);
      taskId = result.taskId;
    }
  } catch (err) {
    // Refund on failure
    await refundCredits(userId, credits, `Workshop refund: ${tool.name}`);
    const message = err instanceof Error ? err.message : "Submission failed";
    console.error(`[workshop/${slug}] error:`, err);
    return NextResponse.json({ error: sanitizeClientError(message, `workshop/${slug}`) }, { status: 500 });
  }

  const generationId = await createWorkshopGeneration({
    userId, slug, tool, credits, taskId,
    provider: routedProvider === "kieai" ? "KIEAI" : "PIAPI",
    body,
  });
  return NextResponse.json({ taskId, generationId, credits });
}
