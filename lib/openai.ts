import OpenAI from "openai";

let _openai: OpenAI | null = null;

/**
 * Lazily construct the OpenAI client.
 *
 * Instantiated on first use inside a request handler rather than at module
 * load, so a missing OPENAI_API_KEY does not throw during the production
 * build. Callers must gate on OPENAI_API_KEY first.
 */
export function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}
