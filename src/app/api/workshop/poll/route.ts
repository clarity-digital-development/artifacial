import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getTaskStatus } from "@/lib/piapi-client";

/**
 * GET /api/workshop/poll?taskId=xxx
 *
 * Lightweight proxy that checks a PiAPI task's status and parses all
 * workshop output types (image, video, audio, text, 3D model).
 * Does NOT modify the database — workshop tasks are fire-and-forget from
 * a persistence standpoint (credits deducted at submission).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const taskId = req.nextUrl.searchParams.get("taskId");
  if (!taskId) {
    return NextResponse.json({ error: "taskId is required" }, { status: 400 });
  }

  try {
    const result = await getTaskStatus(taskId);
    const raw = (result.raw ?? {}) as Record<string, unknown>;
    const output = (
      raw.output ??
      (raw.task_result as Record<string, unknown> | undefined)?.task_output ??
      {}
    ) as Record<string, unknown>;

    let audioUrl: string | undefined;
    let audioUrls: string[] | undefined;
    let text: string | undefined;
    let modelUrl: string | undefined;
    let songId: string | undefined;

    if (result.status === "completed") {
      // ── Audio (music-gen, song-extend, diffrhythm, kling-sound single) ──
      audioUrl =
        (output.audio_url as string) ||
        (typeof output.audio === "string" ? output.audio : undefined) ||
        (output.music_url as string) ||
        (output.song_url as string);

      // ── Udio song ID (needed for song-extend) ──
      // Udio returns songs as an array; grab the first song's ID
      const songsRaw = output.songs ?? output.song_list;
      if (Array.isArray(songsRaw) && songsRaw.length > 0) {
        const first = songsRaw[0] as Record<string, unknown>;
        songId = (first.id ?? first.song_id) as string | undefined;
        // Also extract audio URL from the songs array if not already found
        if (!audioUrl) {
          audioUrl = (first.audio_url ?? first.url ?? first.audio) as string | undefined;
        }
      }
      // Fallback: top-level song_id field
      if (!songId) {
        songId = (output.song_id ?? output.id) as string | undefined;
      }

      // ── Multiple audio variants (Kling Sound returns 4) ──
      const audiosRaw =
        output.audios ?? output.audio_urls ?? output.sounds ?? output.audio_list;
      if (Array.isArray(audiosRaw) && audiosRaw.length > 0) {
        audioUrls = (audiosRaw as unknown[])
          .map((a) =>
            typeof a === "string"
              ? a
              : ((a as Record<string, unknown>)?.url as string) ??
                ((a as Record<string, unknown>)?.audio_url as string)
          )
          .filter(Boolean) as string[];
      }


      // ── Text output (JoyCaption) ──
      text =
        (output.text as string) ||
        (output.caption as string) ||
        (output.description as string) ||
        (output.content as string);

      // ── 3D model (Trellis2 — GLB / mesh URL) ──
      modelUrl =
        (output.model_url as string) ||
        (output.glb_url as string) ||
        (output.mesh_url as string) ||
        (output.output_url as string) ||
        ((output.outputs as Record<string, unknown> | undefined)?.model_url as string);
    }

    return NextResponse.json({
      status: result.status,
      errorMessage: result.errorMessage ?? null,
      // Standard media
      videoUrl: result.videoUrl ?? null,
      imageUrl: result.imageUrl ?? null,
      imageUrls: result.imageUrls ?? null,
      // Workshop-specific
      audioUrl: audioUrl ?? null,
      audioUrls: audioUrls ?? null,
      text: text ?? null,
      modelUrl: modelUrl ?? null,
      songId: songId ?? null,
    });
  } catch (err) {
    console.error("[workshop/poll] error:", err);
    return NextResponse.json(
      { error: "Failed to check task status" },
      { status: 500 }
    );
  }
}
