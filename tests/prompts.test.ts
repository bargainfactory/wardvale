import { describe, it, expect } from "vitest";
import { PROMPT_VERSION, promptVersion } from "@/lib/prompts";
import { AGENT_KEYS } from "@/lib/agents-catalog";

describe("prompt version registry", () => {
  it("has a version for every agent in the catalog", () => {
    for (const key of AGENT_KEYS) {
      expect(PROMPT_VERSION[key], `missing version for ${key}`).toBeTruthy();
    }
  });

  it("resolves a known agent to its version", () => {
    expect(promptVersion("ar-followup")).toBe(PROMPT_VERSION["ar-followup"]);
  });

  it("falls back to default for unknown or empty keys", () => {
    expect(promptVersion(undefined)).toBe(PROMPT_VERSION.default);
    expect(promptVersion(null)).toBe(PROMPT_VERSION.default);
    expect(promptVersion("not-an-agent")).toBe(PROMPT_VERSION.default);
  });
});
