import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";
import { getOpenAI } from "@/lib/openai";
import { getAnthropic } from "@/lib/anthropic";

// ── Single seam for every LLM call (roadmap G3 + multi-provider) ─────────────
// One function over every provider. OpenAI-compatible hosts (OpenAI, xAI Grok,
// Perplexity, Kimi/Moonshot, DeepSeek, OpenRouter, local Ollama) run through the
// OpenAI SDK unchanged — just OPENAI_BASE_URL + OPENAI_MODEL. Claude runs through
// the native Anthropic SDK via a small translation (its Messages API differs:
// system is top-level, sampling params are rejected, and JSON is schema-enforced
// via structured outputs rather than response_format). Route per lane so, e.g.,
// customer-facing drafting/judging can use Claude while classification stays cheap.
//
// callModel returns a normalized, OpenAI-ChatCompletion-shaped result so every
// call site reads `.choices[0].message.content` / `.usage.total_tokens` unchanged.

export type ModelProvider = "openai" | "anthropic";

export type ModelPurpose =
  | "draft" // customer-facing message drafting (agent runtime)
  | "triage" // classification / routing
  | "voice" // spoken receptionist replies (latency-sensitive)
  | "chat" // site + MCP assistant
  | "quote" // sales quote / idea generation
  | "audit" // internal analysis
  | "workflow" // workflow builder
  | "preview" // marketing inbox demo
  | "judge" // LLM-as-judge rubric scoring (U1)
  | "default";

/** Normalized response shape — OpenAI ChatCompletion is structurally assignable. */
export type ModelResponse = {
  choices: { message: { content: string | null } }[];
  usage?: { total_tokens?: number };
  model?: string;
};

const num = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

const DEFAULT_TIMEOUT_MS = num(process.env.OPENAI_TIMEOUT_MS, 20_000);
const DEFAULT_MAX_RETRIES = num(process.env.OPENAI_MAX_RETRIES, 2);

/** Which provider serves a lane: LLM_PROVIDER_<PURPOSE> wins, else LLM_PROVIDER, else openai. */
function providerFor(purpose: ModelPurpose): ModelProvider {
  const per = process.env[`LLM_PROVIDER_${purpose.toUpperCase()}`]?.trim().toLowerCase();
  const glob = process.env.LLM_PROVIDER?.trim().toLowerCase();
  return (per || glob) === "anthropic" ? "anthropic" : "openai";
}

/** Resolve the model id for a provider + lane (env-overridable per lane). */
function modelFor(provider: ModelProvider, purpose: ModelPurpose): string {
  const key = purpose.toUpperCase();
  if (provider === "anthropic") {
    return process.env[`ANTHROPIC_MODEL_${key}`]?.trim() || process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-4-8";
  }
  return process.env[`OPENAI_MODEL_${key}`]?.trim() || process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

export type CallModelOpts = Omit<ChatCompletionCreateParamsNonStreaming, "model" | "stream"> & {
  /** Routes to a model via env override; defaults to the shared model. */
  purpose?: ModelPurpose;
  /** Explicit provider override (wins over purpose/env routing). */
  provider?: ModelProvider;
  /** Explicit model id — wins over `purpose`. */
  model?: string;
  /** Abort the call after this many ms (default 20s / OPENAI_TIMEOUT_MS). */
  timeoutMs?: number;
  /** Bounded retries on 429 / 5xx / network errors (default 2 / OPENAI_MAX_RETRIES). */
  maxRetries?: number;
  /** Caller-provided cancellation. */
  signal?: AbortSignal;
  /** Opt-in schema-enforced JSON on Claude (structured outputs). Ignored by OpenAI-compatible providers. */
  jsonSchema?: Record<string, unknown>;
};

// ── OpenAI ⇄ Anthropic translation (pure, tested) ────────────────────────────

type OpenAIBody = {
  messages?: { role: string; content?: unknown }[];
  max_tokens?: number | null;
  response_format?: { type?: string } | null;
};

const asText = (content: unknown): string => (typeof content === "string" ? content : "");

/**
 * Translate an OpenAI-style chat request into an Anthropic Messages request.
 * System turns are hoisted to the top-level `system` string; sampling params
 * (temperature/top_p/top_k) are dropped (Opus 4.8 / Sonnet 5 reject them). JSON
 * is enforced via structured outputs when a `jsonSchema` is given, otherwise a
 * strict "return only JSON" instruction is appended for `response_format:
 * json_object`. Returns a plain object (the SDK's create() accepts it).
 */
export function toAnthropicRequest(
  body: OpenAIBody,
  model: string,
  opts: { jsonSchema?: Record<string, unknown> } = {}
): Record<string, unknown> {
  const systemParts: string[] = [];
  const messages: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of body.messages ?? []) {
    const content = asText(m.content);
    if (m.role === "system" || m.role === "developer") systemParts.push(content);
    else if (m.role === "user" || m.role === "assistant") messages.push({ role: m.role, content });
  }

  let system = systemParts.filter(Boolean).join("\n\n");
  const wantsJson = opts.jsonSchema != null || body.response_format?.type === "json_object";
  const req: Record<string, unknown> = { model, max_tokens: body.max_tokens ?? 1024, messages };

  if (opts.jsonSchema != null) {
    // Schema-enforced JSON — the reliability win over prompt-and-parse.
    req.output_config = { format: { type: "json_schema", schema: opts.jsonSchema } };
  } else if (wantsJson) {
    system = `${system ? `${system}\n\n` : ""}Return ONLY a single valid JSON object. No prose, no markdown, no code fences.`;
  }
  if (system) req.system = system;
  return req;
}

type AnthropicResult = {
  content?: { type?: string; text?: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
  model?: string;
};

/** Normalize an Anthropic Messages response into the OpenAI-shaped ModelResponse. */
export function fromAnthropicResponse(res: AnthropicResult): ModelResponse {
  const text = (res.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
  const usage =
    res.usage != null
      ? { total_tokens: (res.usage.input_tokens ?? 0) + (res.usage.output_tokens ?? 0) }
      : undefined;
  return { choices: [{ message: { content: text || null } }], usage, model: res.model };
}

async function callAnthropic(
  body: OpenAIBody,
  model: string,
  opts: { jsonSchema?: Record<string, unknown>; timeoutMs?: number; maxRetries?: number; signal?: AbortSignal }
): Promise<ModelResponse> {
  const req = toAnthropicRequest(body, model, { jsonSchema: opts.jsonSchema });
  // Cast at the SDK boundary: the request shape is built + tested above, and
  // structured-outputs (`output_config`) may not be in every SDK version's types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = getAnthropic() as any;
  const res = await client.messages.create(req, {
    timeout: opts.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxRetries: opts.maxRetries ?? DEFAULT_MAX_RETRIES,
    signal: opts.signal,
  });
  return fromAnthropicResponse(res as AnthropicResult);
}

/**
 * Central chat-completion call. Returns a normalized ModelResponse so callers
 * read `.choices` / `.usage` unchanged regardless of provider.
 */
export async function callModel(opts: CallModelOpts): Promise<ModelResponse> {
  const { purpose = "default", provider, model, timeoutMs, maxRetries, signal, jsonSchema, ...body } = opts;
  const resolvedProvider = provider ?? providerFor(purpose);
  const resolvedModel = model || modelFor(resolvedProvider, purpose);

  if (resolvedProvider === "anthropic") {
    return callAnthropic(body as OpenAIBody, resolvedModel, { jsonSchema, timeoutMs, maxRetries, signal });
  }

  const params: ChatCompletionCreateParamsNonStreaming = { ...body, model: resolvedModel, stream: false };
  return getOpenAI().chat.completions.create(params, {
    timeout: timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxRetries: maxRetries ?? DEFAULT_MAX_RETRIES,
    signal,
  });
}
