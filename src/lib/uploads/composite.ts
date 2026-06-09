/**
 * Server-side image compositing helpers backed by sharp.
 *
 * Built for the multi-character NSFW preset flow: Wan 2.6 NSFW only accepts a
 * single image_url, so when a preset needs two reference characters we
 * composite them side-by-side into a single reference frame and feed THAT to
 * the model. The downstream prompt tells the model "the LEFT person" /
 * "the RIGHT person" to disambiguate.
 *
 * General-purpose enough to be reused for any future preset that needs
 * multi-character input on a single-image generator.
 */

import sharp from "sharp";
import { randomUUID } from "crypto";
import { uploadToR2, getSignedR2Url } from "@/lib/r2";
import { safeFetchUserUrl } from "@/lib/security/safe-fetch";

/**
 * Fetch two images, resize each to half-width, place side by side on a
 * single 1280x720 black canvas, upload to R2 under
 * `users/<userId>/composite/<uuid>.jpg`, return a 2-hour signed URL.
 *
 * Both inputs may be R2-signed URLs or arbitrary HTTPS URLs (SSRF-hardened
 * via safeFetchUserUrl).
 */
export async function compositeSideBySideToR2(
  userId: string,
  leftImageUrl: string,
  rightImageUrl: string,
): Promise<string> {
  const [leftBuf, rightBuf] = await Promise.all([
    safeFetchUserUrl(leftImageUrl, { maxBytes: 25 * 1024 * 1024 }),
    safeFetchUserUrl(rightImageUrl, { maxBytes: 25 * 1024 * 1024 }),
  ]);

  // Resize each to 640x720, fit=cover so faces stay framed nicely
  const [leftResized, rightResized] = await Promise.all([
    sharp(leftBuf).resize(640, 720, { fit: "cover", position: "center" }).png().toBuffer(),
    sharp(rightBuf).resize(640, 720, { fit: "cover", position: "center" }).png().toBuffer(),
  ]);

  const composite = await sharp({
    create: { width: 1280, height: 720, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .composite([
      { input: leftResized, left: 0, top: 0 },
      { input: rightResized, left: 640, top: 0 },
    ])
    .jpeg({ quality: 92 })
    .toBuffer();

  const key = `users/${userId}/composite/${randomUUID()}.jpg`;
  await uploadToR2(key, composite, "image/jpeg");
  return getSignedR2Url(key, 7200);
}
