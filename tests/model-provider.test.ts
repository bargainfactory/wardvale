import { describe, it, expect } from "vitest";
import { toAnthropicRequest, fromAnthropicResponse } from "@/lib/model";

describe("toAnthropicRequest (OpenAI → Claude)", () => {
  const base = {
    messages: [
      { role: "system", content: "You are a helpful agent." },
      { role: "user", content: "Draft a reply." },
    ],
    max_tokens: 800,
  };

  it("hoists system turns into the top-level system string", () => {
    const req = toAnthropicRequest(base, "claude-opus-4-8");
    expect(req.system).toBe("You are a helpful agent.");
    expect(req.messages).toEqual([{ role: "user", content: "Draft a reply." }]);
    expect(req.model).toBe("claude-opus-4-8");
    expect(req.max_tokens).toBe(800);
  });

  it("drops sampling params that Opus 4.8 / Sonnet 5 reject", () => {
    const req = toAnthropicRequest({ ...base, ...({ temperature: 0.4, top_p: 0.9 } as object) }, "claude-opus-4-8");
    expect(req).not.toHaveProperty("temperature");
    expect(req).not.toHaveProperty("top_p");
  });

  it("appends a strict JSON instruction for response_format json_object", () => {
    const req = toAnthropicRequest({ ...base, response_format: { type: "json_object" } }, "claude-opus-4-8");
    expect(String(req.system)).toContain("ONLY a single valid JSON object");
    expect(req).not.toHaveProperty("output_config");
  });

  it("uses schema-enforced structured outputs when a jsonSchema is given", () => {
    const schema = { type: "object", properties: { verdict: { type: "string" } }, required: ["verdict"], additionalProperties: false };
    const req = toAnthropicRequest({ ...base, response_format: { type: "json_object" } }, "claude-opus-4-8", { jsonSchema: schema });
    expect(req.output_config).toEqual({ format: { type: "json_schema", schema } });
    // schema mode does NOT also add the prose instruction
    expect(String(req.system)).not.toContain("ONLY a single valid JSON");
  });

  it("defaults max_tokens and omits system when there is none", () => {
    const req = toAnthropicRequest({ messages: [{ role: "user", content: "hi" }] }, "claude-sonnet-5");
    expect(req.max_tokens).toBe(1024);
    expect(req).not.toHaveProperty("system");
  });

  it("preserves an assistant turn (multi-turn chat)", () => {
    const req = toAnthropicRequest(
      { messages: [{ role: "system", content: "S" }, { role: "user", content: "hi" }, { role: "assistant", content: "hello" }, { role: "user", content: "more" }] },
      "claude-opus-4-8"
    );
    expect(req.messages).toEqual([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
      { role: "user", content: "more" },
    ]);
  });
});

describe("fromAnthropicResponse (Claude → normalized)", () => {
  it("concatenates text blocks into choices[0].message.content", () => {
    const r = fromAnthropicResponse({ content: [{ type: "text", text: "Hi " }, { type: "text", text: "there" }], model: "claude-opus-4-8" });
    expect(r.choices[0].message.content).toBe("Hi there");
    expect(r.model).toBe("claude-opus-4-8");
  });

  it("maps input+output tokens to total_tokens", () => {
    const r = fromAnthropicResponse({ content: [], usage: { input_tokens: 30, output_tokens: 12 } });
    expect(r.usage?.total_tokens).toBe(42);
  });

  it("returns null content when there is no text and skips non-text blocks", () => {
    const r = fromAnthropicResponse({ content: [{ type: "thinking", text: "…" }] });
    expect(r.choices[0].message.content).toBeNull();
  });
});
