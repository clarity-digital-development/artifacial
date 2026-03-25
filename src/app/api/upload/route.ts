import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { uploadToR2, getSignedR2Url } from "@/lib/r2";
import { randomUUID } from "crypto";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/webm",
];

/**
 * POST /api/upload — upload a file to R2 and return a signed URL.
 * Used for I2V reference images, end frames, and motion transfer videos
 * so we don't send base64 blobs through the generation pipeline.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}` },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File too large (max 20MB)" },
      { status: 400 }
    );
  }

  const ext = file.name.split(".").pop() || "bin";
  const key = `users/${session.user.id}/uploads/${randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await uploadToR2(key, buffer, file.type);
  const signedUrl = await getSignedR2Url(key, 3600);

  return NextResponse.json({ key, url: signedUrl });
}
