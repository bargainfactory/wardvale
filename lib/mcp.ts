// ── MCP tool-input validation (roadmap U6 hardening) ─────────────────────────
// Validate tools/call arguments against a tool's declared JSON-schema before
// dispatch, so malformed calls are rejected with a clear error instead of
// reaching tool code. Pure + testable.

export type MCPSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

/**
 * Validate call arguments against a tool's schema. Returns an error message, or
 * null when valid. Checks required fields, rejects unknown fields when
 * additionalProperties is false, and enforces primitive types.
 */
export function validateArgs(schema: MCPSchema, args: Record<string, unknown> | undefined): string | null {
  const a = args ?? {};

  for (const req of schema.required ?? []) {
    if (a[req] === undefined || a[req] === null || a[req] === "") return `Missing required argument: ${req}`;
  }

  if (schema.additionalProperties === false) {
    for (const k of Object.keys(a)) {
      if (!(k in schema.properties)) return `Unknown argument: ${k}`;
    }
  }

  for (const [k, v] of Object.entries(a)) {
    const expected = (schema.properties[k] as { type?: string } | undefined)?.type;
    if (expected === "string" && typeof v !== "string") return `Argument "${k}" must be a string`;
    if (expected === "number" && typeof v !== "number") return `Argument "${k}" must be a number`;
    if (expected === "boolean" && typeof v !== "boolean") return `Argument "${k}" must be a boolean`;
  }

  return null;
}
