/**
 * Shared image input resolver. Accepts either:
 *  - a base64 data URL (`data:image/png;base64,…`) — uploaded to R2, returns
 *    a 2-hour signed URL
 *  - an already-public URL — passed through unchanged
 *  - null/undefined/non-string → undefined
 *
 * `subdir` controls the R2 key path: `users/<userId>/<subdir>/<uuid>.<ext>`.
 * Defaults to `workshop` for back-compat with the existing workshop route.
 */

import { randomUUID } from "crypto";
import { uploadToR2, getSignedR2Url } from "@/lib/r2";

export function isBase64DataUrl(v: unknown): v is string {
  return typeof v === "string" && v.startsWith("data:");
}

export async function uploadBase64ToR2(
  userId: string,
  dataUrl: string,
  subdir: string = "workshop",
): Promise<string> {
  const match = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) throw new Error("Invalid base64 data URL");
  const [, mimeType, base64] = match;
  const ext = mimeType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const key = `users/${userId}/${subdir}/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(base64, "base64");
  await uploadToR2(key, buffer, mimeType);
  return getSignedR2Url(key, 7200);
}

/** Resolve one image field: base64 → R2 signed URL, URL string → pass-through. */
export async function resolveImage(
  userId: string,
  v: unknown,
  subdir: string = "workshop",
): Promise<string | undefined> {
  if (!v) return undefined;
  if (isBase64DataUrl(v)) return uploadBase64ToR2(userId, v, subdir);
  if (typeof v === "string") return v;
  return undefined;
}

/** Resolve every image in an array. Filters out null/undefined results. */
export async function resolveImageArray(
  userId: string,
  arr: unknown,
  subdir: string = "workshop",
): Promise<string[]> {
  if (!Array.isArray(arr)) return [];
  const results = await Promise.all(arr.map((v) => resolveImage(userId, v, subdir)));
  return results.filter(Boolean) as string[];
}
