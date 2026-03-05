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

export async function generateImageWithGemini(
  prompt: string,
  referenceImageBase64?: string
): Promise<Buffer> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY not configured");

  const model = "gemini-2.0-flash-exp-image-generation";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const parts: Record<string, unknown>[] = [];

  if (referenceImageBase64) {
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: referenceImageBase64,
      },
    });
  }

  parts.push({
    text: prompt + "\n\nGenerate an image based on this description.",
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
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const data: GeminiImageResponse = await res.json();
  const imagePart = data.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData
  );

  if (!imagePart?.inlineData) {
    throw new Error("No image returned from Gemini");
  }

  return Buffer.from(imagePart.inlineData.data, "base64");
}
