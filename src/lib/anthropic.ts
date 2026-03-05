// Claude Haiku prompt enhancement for video generation
// Enhances user prompts into detailed, cinematic video descriptions

import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

function getClient() {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  }
  return _client;
}

const SYSTEM_PROMPT = `You are a video prompt engineer for an AI video generation system. Your job is to take a user's brief video description and expand it into a detailed, cinematic prompt optimized for AI video generation.

Guidelines:
- Expand the description with specific visual details: lighting, camera movement, environment, mood, textures
- Keep the core idea intact — don't change what the user wants, just enrich it
- Write in present tense, describing the scene as it unfolds
- Include camera direction (tracking shot, close-up, wide angle, slow pan, etc.)
- Add atmospheric details (lighting quality, time of day, weather, ambient effects)
- Keep it under 200 words — concise but vivid
- Do NOT include any preamble or explanation — just output the enhanced prompt`;

export async function enhanceVideoPrompt(
  userPrompt: string,
  characterDescription?: string
): Promise<string> {
  const userMessage = characterDescription
    ? `Character: ${characterDescription}\n\nVideo idea: ${userPrompt}`
    : userPrompt;

  const response = await getClient().messages.create({
    model: "claude-haiku-4-5-20251022",
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content[0];
  if (text.type !== "text") {
    throw new Error("Unexpected response type from Claude");
  }

  return text.text.trim();
}
