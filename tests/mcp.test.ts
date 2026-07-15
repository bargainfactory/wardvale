import { describe, it, expect } from "vitest";
import { validateArgs, type MCPSchema } from "@/lib/mcp";

const schema: MCPSchema = {
  type: "object",
  properties: { business: { type: "string" }, workflow: { type: "string" }, count: { type: "number" } },
  required: ["business", "workflow"],
  additionalProperties: false,
};

describe("validateArgs (MCP tool-input hardening)", () => {
  it("accepts valid args", () => {
    expect(validateArgs(schema, { business: "dentist", workflow: "reminders" })).toBeNull();
  });

  it("rejects a missing required arg (including empty string)", () => {
    expect(validateArgs(schema, { business: "dentist" })).toContain("Missing required argument: workflow");
    expect(validateArgs(schema, { business: "", workflow: "x" })).toContain("Missing required argument: business");
  });

  it("rejects an unknown arg when additionalProperties is false", () => {
    expect(validateArgs(schema, { business: "d", workflow: "w", bogus: 1 })).toContain("Unknown argument: bogus");
  });

  it("enforces primitive types", () => {
    expect(validateArgs(schema, { business: "d", workflow: "w", count: "nope" })).toContain('Argument "count" must be a number');
    expect(validateArgs(schema, { business: 42 as unknown as string, workflow: "w" })).toContain('Argument "business" must be a string');
  });

  it("treats undefined args as empty", () => {
    expect(validateArgs({ type: "object", properties: {} }, undefined)).toBeNull();
  });
});
