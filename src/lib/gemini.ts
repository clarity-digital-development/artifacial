const STYLE_PREFIXES: Record<string, string> = {
  photorealistic:
    "Ultra-realistic photograph, 8K detail, natural skin texture, professional photography,",
  cinematic:
    "Cinematic film still, anamorphic lens, shallow depth of field, dramatic color grading,",
  stylized:
    "Digital art illustration, highly detailed, vibrant colors, concept art quality,",
  anime:
    "High-quality anime artwork, detailed cel shading, expressive eyes, clean line art,",
};

const ANGLE_PROMPTS = [
  "front-facing portrait, centered composition, studio lighting",
  "three-quarter view facing left, cinematic lighting",
  "three-quarter view facing right, cinematic lighting",
  "full body shot, standing pose, dramatic lighting",
];

export function buildCharacterPrompts(
  style: string,
  description: string
): string[] {
  const prefix = STYLE_PREFIXES[style] ?? STYLE_PREFIXES.photorealistic;
  return ANGLE_PROMPTS.map(
    (angle) => `${prefix} ${description}, ${angle}`
  );
}

interface GeminiImageResponse {
  candidates?: {
    content?: {
      parts?: {
        inlineData?: {
          mimeType: string;
          data: string;
        };
        text?: string;
      }[];
    };
  }[];
}

export const GEMINI_IMAGE_MODELS = [
  { value: "gemini-2.5-flash-image", label: "Nano Banana Flash" },
  { value: "gemini-3-pro-image-preview", label: "Nano Banana Pro" },
  { value: "gemini-3.1-flash-image-preview", label: "Nano Banana 2" },
] as const;

export type GeminiImageModel = (typeof GEMINI_IMAGE_MODELS)[number]["value"];

const DEFAULT_MODEL: GeminiImageModel = "gemini-2.5-flash-image";

export async function generateImageWithGemini(
  prompt: string,
  referenceImageBase64?: string,
  model?: string,
  aspectRatio?: string
): Promise<Buffer> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not configured");

  const validModels = GEMINI_IMAGE_MODELS.map((m) => m.value) as string[];
  const selectedModel = model && validModels.includes(model) ? model : DEFAULT_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;

  console.log(`[gemini] Request: model=${selectedModel}, hasRef=${!!referenceImageBase64}, aspectRatio=${aspectRatio}, prompt="${prompt.slice(0, 80)}..."`);

  const parts: Record<string, unknown>[] = [];

  if (referenceImageBase64) {
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: referenceImageBase64,
      },
    });
  }

  const arSuffix = aspectRatio && aspectRatio !== "1:1"
    ? ` Output the image in ${aspectRatio} aspect ratio.`
    : "";
  parts.push({
    text: prompt + "\n\nGenerate an image based on this description." + arSuffix,
  });

  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[gemini] API error: model=${selectedModel}, status=${res.status}, body=${errText.slice(0, 500)}`);
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const data: GeminiImageResponse = await res.json();
  const imagePart = data.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData
  );

  if (!imagePart?.inlineData) {
    console.error(`[gemini] No image in response: model=${selectedModel}, candidates=${data.candidates?.length ?? 0}, parts=${data.candidates?.[0]?.content?.parts?.length ?? 0}`);
    throw new Error("No image returned from Gemini");
  }

  console.log(`[gemini] Success: model=${selectedModel}, imageSize=${imagePart.inlineData.data.length} chars`);
  return Buffer.from(imagePart.inlineData.data, "base64");
}
