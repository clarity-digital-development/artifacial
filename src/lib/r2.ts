import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let _s3: S3Client | null = null;

function getS3() {
  if (!_s3) {
    _s3 = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _s3;
}

const bucket = () => process.env.R2_BUCKET_NAME!;

export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  await getS3().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return key;
}

export async function getSignedR2Url(
  key: string,
  expiresIn = 3600
): Promise<string> {
  return getSignedUrl(
    getS3(),
    new GetObjectCommand({ Bucket: bucket(), Key: key }),
    { expiresIn }
  );
}

export function r2KeyForUpload(userId: string, characterId: string, filename: string) {
  return `users/${userId}/uploads/${characterId}/${filename}`;
}

export function r2KeyForCharacterImage(
  userId: string,
  characterId: string,
  angle: string
) {
  return `users/${userId}/characters/${characterId}/${angle}.webp`;
}

export function r2KeyForScene(userId: string, sceneId: string, type: "video" | "thumbnail") {
  const ext = type === "video" ? "mp4" : "webp";
  return `users/${userId}/scenes/${sceneId}/${type}.${ext}`;
}

export function r2KeyForProject(userId: string, projectId: string) {
  return `users/${userId}/projects/${projectId}/final.mp4`;
}
