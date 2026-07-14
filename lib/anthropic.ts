import Anthropic from "@anthropic-ai/sdk";

let _anthropic: Anthropic | null = null;

/**
 * Lazily construct the Anthropic (Claude) client.
 *
 * Instantiated on first use so a missing ANTHROPIC_API_KEY never throws during
 * the production build. Used only when a lane is routed to the "anthropic"
 * provider (see lib/model.ts); callers reach it through callModel(), never
 * directly. Claude's Messages API differs from OpenAI's chat completions — the
 * translation lives in lib/model.ts.
 */
export function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _anthropic;
}
