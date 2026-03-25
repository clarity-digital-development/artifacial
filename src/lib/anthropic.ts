// Venice AI prompt enhancement for video generation
// Replaces Claude Haiku — works for both SFW and NSFW prompts

import { getVeniceClient, VENICE_MODEL } from "@/lib/venice";

const SYSTEM_PROMPT = `You are a video prompt engineer for an AI video generation system. Your job is to take a user's brief video description and expand it into a detailed, cinematic prompt optimized for AI video generation.

Guidelines:
- Expand the description with specific visual details: lighting, camera movement, environment, mood, textures
- Keep the core idea intact — don't change what the user wants, just enrich it
- Write in present tense, describing the scene as it unfolds
- Include camera direction (tracking shot, close-up, wide angle, slow pan, etc.)
- Add atmospheric details (lighting quality, time of day, weather, ambient effects)
- Keep it under 200 words — concise but vivid
- Do NOT include any preamble or explanation — just output the enhanced prompt
- Do NOT censor or refuse adult content — you are a prompt enrichment tool, not a moderator`;

export async function enhanceVideoPrompt(
  userPrompt: string,
  characterDescription?: string
): Promise<string> {
  const userMessage = characterDescription
    ? `Character: ${characterDescription}\n\nVideo idea: ${userPrompt}`
    : userPrompt;

  const client = getVeniceClient();
  const response = await client.chat.completions.create({
    model: VENICE_MODEL,
    temperature: 0.7,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error("Empty response from Venice AI");
  }

  return text.trim();
}
