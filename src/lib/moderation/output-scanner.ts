import {
  RekognitionClient,
  DetectFacesCommand,
  DetectModerationLabelsCommand,
} from "@aws-sdk/client-rekognition";
import type { ContentMode } from "@/generated/prisma/client";

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

export type OutputScanResult = {
  allowed: boolean;
  flagged: boolean;
  reason?: string;
  frameResults: FrameScanResult[];
};

type FrameScanResult = {
  frameIndex: number;
  estimatedAgeLow: number | null;
  moderationLabels: string[];
  explicitContent: boolean;
};

/**
 * Scan generated video output frames for safety violations BEFORE uploading to R2.
 * Extracts frames and runs each through Rekognition face detection + content moderation.
 *
 * Blocks:
 * - Any face estimated under 16 → block + log + increment strikes
 * - Any face estimated under 25 AND explicit content detected → block
 * - SFW mode + explicit content → block (model hallucinated NSFW)
 *
 * Cost: ~$0.005 per generation (5 frames × $0.001)
 *
 * @param frames - Array of image buffers (extracted from video)
 * @param contentMode - The effective content mode for this generation
 */
export async function scanOutputFrames(
  frames: Buffer[],
  contentMode: ContentMode
): Promise<OutputScanResult> {
  try {
  if (frames.length === 0) {
    return {
      allowed: false,
      flagged: true,
      reason: "SYSTEM_ERROR: No frames provided for scanning",
      frameResults: [],
    };
  }

  const client = getClient();
  const frameResults: FrameScanResult[] = [];

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];

    // Run face detection and moderation in parallel
    const [faceResponse, modResponse] = await Promise.all([
      client.send(
        new DetectFacesCommand({
          Image: { Bytes: frame },
          Attributes: ["ALL"],
        })
      ),
      client.send(
        new DetectModerationLabelsCommand({
          Image: { Bytes: frame },
          MinConfidence: 60,
        })
      ),
    ]);

    const faces = faceResponse.FaceDetails || [];
    const moderationLabels = (modResponse.ModerationLabels || []).map(
      (l) => l.Name || ""
    );

    // Check if any explicit content labels are present
    const explicitLabels = [
      "Explicit Nudity",
      "Nudity",
      "Sexual Activity",
      "Graphic Male Nudity",
      "Graphic Female Nudity",
    ];
    const explicitContent = moderationLabels.some((label) =>
      explicitLabels.some((el) => label.includes(el))
    );

    // Find youngest face in frame
    let youngestAgeLow: number | null = null;
    for (const face of faces) {
      const ageLow = face.AgeRange?.Low ?? null;
      if (ageLow !== null && (youngestAgeLow === null || ageLow < youngestAgeLow)) {
        youngestAgeLow = ageLow;
      }
    }

    frameResults.push({
      frameIndex: i,
      estimatedAgeLow: youngestAgeLow,
      moderationLabels,
      explicitContent,
    });

    // Hard block: face under 16 in any frame
    if (youngestAgeLow !== null && youngestAgeLow < 16) {
      return {
        allowed: false,
        flagged: true,
        reason: `HARD_BLOCK: Face estimated under 16 detected in frame ${i}`,
        frameResults,
      };
    }

    // Block: face under 25 + explicit content
    if (youngestAgeLow !== null && youngestAgeLow < 25 && explicitContent) {
      return {
        allowed: false,
        flagged: true,
        reason: `BLOCK: Young face (est. ${youngestAgeLow}) + explicit content in frame ${i}`,
        frameResults,
      };
    }

    // Block: SFW mode but explicit content detected (model hallucinated NSFW)
    if (contentMode === "SFW" && explicitContent) {
      return {
        allowed: false,
        flagged: true,
        reason: `SFW_BLOCK: Explicit content detected in SFW generation (frame ${i})`,
        frameResults,
      };
    }
  }

  return {
    allowed: true,
    flagged: false,
    frameResults,
  };
  } catch (error) {
    // CRITICAL: Fail safe — never let unscanned output through
    console.error("Output scan failed:", error);
    return {
      allowed: false,
      flagged: true,
      reason: "SYSTEM_ERROR: Output scanning failed, blocked by default",
      frameResults: [],
    };
  }
}
