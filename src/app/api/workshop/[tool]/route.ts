import { auth } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { getToolBySlug } from "@/lib/workshop/tools";
import { deductCredits, refundCredits } from "@/lib/credits";
import { submitTask } from "@/lib/piapi-client";
import { uploadToR2, getSignedR2Url } from "@/lib/r2";
import { randomUUID } from "crypto";
import {
  submitIdeogramCharacterRemix,
  submitRecraftCrispUpscale,
  submitGrokVideoUpscale,
} from "@/lib/kieai";

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

// ─── Credit computation ───────────────────────────────────────────────────────

function computeCredits(slug: string, body: Record<string, unknown>): number {
  switch (slug) {
    case "photo-face-swap":   return 40;
    case "multi-face-swap":   return 60;
    case "video-face-swap":   return 2400;
    case "virtual-try-on":    return 280 * (Number(body.batchSize) || 1);
    case "ai-hug":            return 800;
    case "lipsync":           return 400;
    case "effects":           return body.professionalMode ? 1840 : 1040;
    case "kling-sound":       return 280;
    case "ai-video-edit": {
      const is1080 = body.resolution === "1080p";
      const is10s  = Number(body.duration) === 10;
      if (is1080 && is10s) return 4160;
      if (is1080)          return 2080;
      if (is10s)           return 3120;
      return 1560;
    }
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
    case "ideogram-character":
      return 240;
    case "ideogram-character-remix":
      return 240 * Math.max(1, Math.min(4, Number(body.numImages ?? 1)));
    case "recraft-crisp-upscale":
      return 60;
    case "grok-video-upscale":
      return 600;
    default:                  return 100;
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

    case "ai-video-edit": {
      if (!body.prompt) throw new Error("Missing prompt");
      const input: Record<string, unknown> = {
        prompt: body.prompt,
        duration: Number(body.duration) || 5,
        aspect_ratio: body.aspectRatio || "16:9",
      };
      if (body.resolution) input.resolution = (body.resolution as string).toLowerCase();
      if (Array.isArray(body.images) && body.images.length > 0) {
        input.images = await resolveImgArray(userId, body.images);
      }
      if (body.videoUrl) {
        input.video_url = body.videoUrl;
        if (body.keepOriginalAudio) input.keep_original_audio = true;
      }
      return { model: "kling", taskType: "omni_video_generation", input };
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
  if (slug === "ideogram-character") {
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
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    return NextResponse.json({ taskId, credits });
  }

  // ── KIE.AI tools (ideogram-remix, recraft, grok) ──
  const kieAiTools = ["ideogram-character-remix", "recraft-crisp-upscale", "grok-video-upscale"];
  if (kieAiTools.includes(slug)) {
    const callbackUrl = `${process.env.APP_URL ?? "https://artifacial.app"}/api/webhooks/kieai`;
    let kieTaskId: string;
    const isImageOutput = slug !== "grok-video-upscale";

    try {
      console.log(`[workshop/${slug}] starting KIE.AI submission, body keys:`, Object.keys(body));
      if (slug === "ideogram-character-remix") {
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
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const prefix = isImageOutput ? "kieai:image:" : "kieai:video:";
    return NextResponse.json({ taskId: `${prefix}${kieTaskId}`, credits });
  }

  let taskId: string;
  try {
    const { model, taskType, input } = await buildTask(slug, body, userId);
    const result = await submitTask(model, taskType, input);
    taskId = result.taskId;
  } catch (err) {
    // Refund on failure
    await refundCredits(userId, credits, `Workshop refund: ${tool.name}`);
    const message = err instanceof Error ? err.message : "Submission failed";
    console.error(`[workshop/${slug}] error:`, err);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ taskId, credits });
}
