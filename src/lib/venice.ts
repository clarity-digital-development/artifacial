// Venice AI client — OpenAI-compatible API for prompt enrichment + classification
// Replaces Anthropic/Haiku for both SFW and NSFW prompt processing

import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getVeniceClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.VENICE_API_KEY!,
      baseURL: "https://api.venice.ai/api/v1",
    });
  }
  return _client;
}

export const VENICE_MODEL = "llama-3.3-70b";
