import {
  RekognitionClient,
  DetectFacesCommand,
  DetectModerationLabelsCommand,
} from "@aws-sdk/client-rekognition";

let _client: RekognitionClient | null = null;

function getClient() {
  if (!_client) {
    _client = new RekognitionClient({
      region: process.env.AWS_REGION ?? "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _client;
}

export type FaceScanResult = {
  allowed: boolean;
  estimatedAgeRange: { low: number; high: number } | null;
  faceCount: number;
  moderationLabels: string[];
  nsfwEligible: boolean;
  reason?: string;
};

/**
 * Scan an uploaded selfie for face detection, age estimation, and content moderation.
 * Runs during character creation — blocks minors, flags young adults as SFW-only.
 *
 * Thresholds:
 * - Lower bound < 16 → hard block (cannot create character)
 * - Lower bound 16–24 → character created with nsfwEligible: false
 * - Lower bound ≥ 25 → character created with nsfwEligible: true
 *
 * Cost: ~$0.001 per image (Rekognition pricing)
 */
export async function scanUploadedFace(
  imageBuffer: Buffer
): Promise<FaceScanResult> {
  try {
    const client = getClient();

    // Step 1: Detect faces and get age estimates
    const faceResponse = await client.send(
      new DetectFacesCommand({
        Image: { Bytes: imageBuffer },
        Attributes: ["ALL"],
      })
    );

    const faces = faceResponse.FaceDetails || [];

    if (faces.length === 0) {
      return {
        allowed: false,
        estimatedAgeRange: null,
        faceCount: 0,
        moderationLabels: [],
        nsfwEligible: false,
        reason: "NO_FACE_DETECTED: Upload must contain a clearly visible face",
      };
    }

    // Use the primary (largest) face
    const primaryFace = faces.sort(
      (a, b) =>
        (b.BoundingBox?.Width ?? 0) * (b.BoundingBox?.Height ?? 0) -
        (a.BoundingBox?.Width ?? 0) * (a.BoundingBox?.Height ?? 0)
    )[0];

    const ageRange = primaryFace.AgeRange;

    // If Rekognition couldn't estimate age (obscured/low-quality face), block with clear message
    if (ageRange?.Low == null || ageRange?.High == null) {
      return {
        allowed: false,
        estimatedAgeRange: null,
        faceCount: faces.length,
        moderationLabels: [],
        nsfwEligible: false,
        reason: "FACE_QUALITY: Could not estimate age, please upload a clearer photo",
      };
    }

    const lowAge = ageRange.Low;
    const highAge = ageRange.High;

    // HARD BLOCK: Estimated age lower bound under 16
    if (lowAge < 16) {
      return {
        allowed: false,
        estimatedAgeRange: { low: lowAge, high: highAge },
        faceCount: faces.length,
        moderationLabels: [],
        nsfwEligible: false,
        reason: "AGE_BLOCK: Estimated age too young for character creation",
      };
    }

    // Step 2: Run content moderation on the image itself
    const modResponse = await client.send(
      new DetectModerationLabelsCommand({
        Image: { Bytes: imageBuffer },
        MinConfidence: 60,
      })
    );

    const moderationLabels = (modResponse.ModerationLabels || []).map(
      (l) => l.Name || ""
    );

    // Lower bound 16–24: SFW only (nsfwEligible: false)
    // Lower bound ≥ 25: Fully eligible (nsfwEligible: true)
    const nsfwEligible = lowAge >= 25;

    return {
      allowed: true,
      estimatedAgeRange: { low: lowAge, high: highAge },
      faceCount: faces.length,
      moderationLabels,
      nsfwEligible,
      reason: nsfwEligible
        ? undefined
        : "AGE_CAUTION: Character restricted to SFW workflows (estimated age under 25)",
    };
  } catch (error) {
    // CRITICAL: Fail safe — never let an unscanned face through
    console.error("Face scan failed:", error);
    return {
      allowed: false,
      estimatedAgeRange: null,
      faceCount: 0,
      moderationLabels: [],
      nsfwEligible: false,
      reason: "SYSTEM_ERROR: Face scanning failed, blocked by default",
    };
  }
}
