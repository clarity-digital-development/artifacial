/**
 * Shared media-persistence helpers used by both the main generation status
 * route and the workshop poll. Downloads provider-hosted media (which has
 * a short-lived signed URL) into our own R2 bucket and produces a thumbnail
 * so the output can be displayed in the gallery later.
 */

import { uploadToR2 } from "@/lib/r2";

export function r2KeyForGeneration(
  userId: string,
  generationId: string,
  ext: string,
): string {
  return `users/${userId}/generations/${generationId}/output.${ext}`;
}

export function r2KeyForThumbnail(generationId: string): string {
  return `thumbnails/${generationId}.webp`;
}

/**
 * Download media from a URL and upload it to R2.
 * Returns the R2 key plus the downloaded buffer (for thumbnail generation).
 * External URLs expire, so we must persist to our own storage.
 */
export async function persistMediaToR2(
  mediaUrl: string,
  userId: string,
  generationId: string,
  defaultExt: string = "mp4",
): Promise<{ key: string; buffer: Buffer; contentType: string }> {
  const response = await fetch(mediaUrl);
  if (!response.ok) {
    throw new Error(`Failed to download media: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || `video/${defaultExt}`;
  let ext = defaultExt;
  if (contentType.includes("webm")) ext = "webm";
  else if (contentType.includes("webp")) ext = "webp";
  else if (contentType.includes("png")) ext = "png";
  else if (contentType.includes("jpeg") || contentType.includes("jpg")) ext = "jpg";
  else if (contentType.includes("mpeg") || contentType.includes("mp3")) ext = "mp3";
  else if (contentType.includes("wav")) ext = "wav";
  else if (contentType.includes("model/gltf-binary") || contentType.includes("glb")) ext = "glb";

  const buffer = Buffer.from(await response.arrayBuffer());
  const key = r2KeyForGeneration(userId, generationId, ext);

  await uploadToR2(key, buffer, contentType);
  return { key, buffer, contentType };
}

/**
 * Generate a thumbnail from an image buffer using sharp.
 * Resizes to max 400px wide, quality 70, WebP format.
 * Returns the R2 key or null if thumbnail generation fails.
 */
export async function generateImageThumbnail(
  imageBuffer: Buffer,
  generationId: string,
): Promise<string | null> {
  try {
    const sharp = (await import("sharp")).default;
    const thumbnailBuffer = await sharp(imageBuffer)
      .resize({ width: 400, withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer();

    const thumbnailKey = r2KeyForThumbnail(generationId);
    await uploadToR2(thumbnailKey, thumbnailBuffer, "image/webp");
    return thumbnailKey;
  } catch (err) {
    console.error(`[persist] Image thumbnail failed gen=${generationId}:`, err);
    return null;
  }
}

/**
 * Extract first frame from a video buffer using ffmpeg, then resize with sharp.
 * ffmpeg reads from stdin and writes a PNG frame to stdout — no temp files.
 */
export async function generateVideoThumbnail(
  videoBuffer: Buffer,
  generationId: string,
): Promise<string | null> {
  try {
    const { execFile } = await import("child_process");
    const sharp = (await import("sharp")).default;

    const frameBuffer = await new Promise<Buffer>((resolve, reject) => {
      const proc = execFile(
        "ffmpeg",
        [
          "-i", "pipe:0",
          "-vframes", "1",
          "-f", "image2pipe",
          "-vcodec", "png",
          "pipe:1",
        ],
        { maxBuffer: 10 * 1024 * 1024, encoding: "buffer" as BufferEncoding },
        (err, stdout) => {
          if (err) reject(err);
          else resolve(Buffer.from(stdout as unknown as ArrayBuffer));
        },
      );
      proc.stdin?.write(videoBuffer);
      proc.stdin?.end();
    });

    const thumbnailBuffer = await sharp(frameBuffer)
      .resize({ width: 400, withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer();

    const thumbnailKey = r2KeyForThumbnail(generationId);
    await uploadToR2(thumbnailKey, thumbnailBuffer, "image/webp");
    return thumbnailKey;
  } catch (err) {
    console.error(`[persist] Video thumbnail failed gen=${generationId}:`, err);
    return null;
  }
}
