import OpenAI from "openai";

let _openai: OpenAI | null = null;

/**
 * Lazily construct the OpenAI(-compatible) client.
 *
 * Instantiated on first use inside a request handler rather than at module
 * load, so a missing OPENAI_API_KEY does not throw during the production build.
 * Callers must gate on OPENAI_API_KEY first.
 *
 * OPENAI_BASE_URL points the same OpenAI SDK at any OpenAI-compatible provider
 * (xAI Grok, Perplexity, Kimi/Moonshot, DeepSeek, OpenRouter, local Ollama, …) —
 * no other code changes; just set the base URL, key, and OPENAI_MODEL.
 */
export function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL?.trim() || undefined,
    });
  }
  return _openai;
}
