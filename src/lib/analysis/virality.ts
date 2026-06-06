/**
 * Virality Predictor — extracts evenly-spaced keyframes from a video and
 * sends them to Claude Sonnet 4.6 with a brutally-honest virality rubric.
 *
 * Returns a structured ViralityScore with hook score, retention risk,
 * specific critique, and concrete recommendations. The honest-critique
 * tone is the moat per docs/higgsfield-roadmap.md §3 Tool #12 —
 * competitor tools default to sycophantic feedback.
 */

import Anthropic from "@anthropic-ai/sdk";
import { execFile } from "child_process";
import { writeFile, readFile, unlink, mkdtemp } from "fs/promises";
import path from "path";
import os from "os";

export interface ViralityScore {
  /** 0-100 — overall viral potential */
  overallScore: number;
  /** 0-100 — strength of the first 3 seconds (the hook) */
  hookScore: number;
  /** 0-100 — likelihood viewers finish the video */
  retentionScore: number;
  /** 0-100 — how scroll-stopping the visual is in feed thumbnails */
  scrollStopScore: number;
  /** Honest 2-3 sentence critique of the hook */
  hookCritique: string;
  /** Honest 2-3 sentence critique of overall content / pacing */
  contentCritique: string;
  /** 3-5 concrete actionable recommendations to raise the score */
  recommendations: string[];
  /** 1-2 sentence overall verdict the user should walk away with */
  verdict: string;
}

const SYSTEM_PROMPT = `You are a brutally honest viral content analyst. You analyze short-form video frames for TikTok / Reels / YouTube Shorts virality. Your job is to give the creator real feedback that will actually improve their content — not validation.

You will receive 6 evenly-spaced keyframes from a video clip (representing the hook frame, mid-clip, and ending). Score each on the rubric below and return ONLY a single JSON object that matches the schema. No prose outside the JSON.

Scoring rubric (be strict, not generous — most content scores 30-60, viral content scores 70+):

- **overallScore (0-100)**: holistic viral potential. <40 = won't perform. 40-60 = niche or modest reach. 60-75 = solid. 75-85 = strong. 85+ = banger territory.
- **hookScore (0-100)**: strength of the first frame as a scroll-stopper. Specifically: does it tell the viewer in <1s what they're about to see? Does it create curiosity, surprise, or pattern interrupt? Generic talking-head openers score <40.
- **retentionScore (0-100)**: based on visual variation across the keyframes, does it look like the energy stays up or drops? Static / flat-energy clips score lower.
- **scrollStopScore (0-100)**: how visually arresting is the first frame as a thumbnail in a busy feed?

Critique style:
- Be SPECIFIC ("The hook is a static headshot with no motion or expression change — that's the weakest possible opener.") not generic ("The hook could be improved.").
- Call out actual problems by name. Don't soften with hedges.
- For recommendations, give concrete creative direction the creator can act on TODAY.

Return ONLY this JSON shape — no markdown fences, no prose:
{
  "overallScore": number,
  "hookScore": number,
  "retentionScore": number,
  "scrollStopScore": number,
  "hookCritique": string,
  "contentCritique": string,
  "recommendations": [string, string, ...],
  "verdict": string
}`;

const FRAME_COUNT = 6;

/**
 * Extract N evenly-spaced JPEG frames from the video using ffmpeg.
 * Returns an array of frame buffers in chronological order.
 */
async function extractFrames(videoBuffer: Buffer, count: number = FRAME_COUNT): Promise<Buffer[]> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "virality-"));
  const inputPath = path.join(dir, "input.mp4");
  const outputPattern = path.join(dir, "frame-%02d.jpg");

  try {
    await writeFile(inputPath, videoBuffer);

    // Get duration via ffprobe
    const durationStr = await new Promise<string>((resolve, reject) => {
      execFile(
        "ffprobe",
        ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", inputPath],
        (err, stdout) => err ? reject(err) : resolve(stdout.toString().trim()),
      );
    });
    const duration = Math.max(1, parseFloat(durationStr) || 1);
    const fps = count / duration;

    // Extract N frames evenly spaced, resized to 512px wide for token economy
    await new Promise<void>((resolve, reject) => {
      execFile(
        "ffmpeg",
        [
          "-i", inputPath,
          "-vf", `fps=${fps},scale=512:-1`,
          "-vframes", String(count),
          "-q:v", "5",
          outputPattern,
        ],
        { maxBuffer: 20 * 1024 * 1024 },
        (err) => err ? reject(err) : resolve(),
      );
    });

    // Read all generated frames
    const frames: Buffer[] = [];
    for (let i = 1; i <= count; i++) {
      const framePath = path.join(dir, `frame-${String(i).padStart(2, "0")}.jpg`);
      try {
        frames.push(await readFile(framePath));
      } catch {
        // Some videos may produce fewer frames than requested — skip missing
      }
    }
    if (frames.length === 0) throw new Error("ffmpeg produced no frames");
    return frames;
  } finally {
    // Cleanup
    try {
      await unlink(inputPath);
      for (let i = 1; i <= count; i++) {
        await unlink(path.join(dir, `frame-${String(i).padStart(2, "0")}.jpg`)).catch(() => {});
      }
    } catch { /* ignore */ }
  }
}

/**
 * Analyze a video for virality. Returns a brutal-honest structured score.
 * Throws if ffmpeg fails, ANTHROPIC_API_KEY is missing, or Claude returns
 * an unparseable response.
 */
export async function analyzeVirality(videoBuffer: Buffer): Promise<ViralityScore> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const frames = await extractFrames(videoBuffer);
  console.log(`[virality] extracted ${frames.length} frames`);

  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2000,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: [
          ...frames.map((buf, idx) => ({
            type: "image" as const,
            source: {
              type: "base64" as const,
              media_type: "image/jpeg" as const,
              data: buf.toString("base64"),
            },
          })),
          {
            type: "text" as const,
            text: `Analyze these ${frames.length} keyframes (chronological order, frame 1 = hook, last frame = ending). Return ONLY the JSON object as specified.`,
          },
        ],
      },
    ],
  });

  // Extract text from response
  const textBlock = response.content.find((c) => c.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text content");
  }
  const text = textBlock.text;

  // Find the JSON object — tolerate markdown fences or stray prose
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON object found in Claude response");
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as ViralityScore;
    // Defensive normalization
    return {
      overallScore: clamp(Math.round(Number(parsed.overallScore) || 0)),
      hookScore: clamp(Math.round(Number(parsed.hookScore) || 0)),
      retentionScore: clamp(Math.round(Number(parsed.retentionScore) || 0)),
      scrollStopScore: clamp(Math.round(Number(parsed.scrollStopScore) || 0)),
      hookCritique: String(parsed.hookCritique || ""),
      contentCritique: String(parsed.contentCritique || ""),
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.map(String) : [],
      verdict: String(parsed.verdict || ""),
    };
  } catch (err) {
    console.error("[virality] JSON parse failed:", err);
    throw new Error("Could not parse Claude's response — please try again");
  }
}

function clamp(v: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(100, v));
}
