import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
} from "openai/resources/chat/completions";
import { getOpenAI } from "@/lib/openai";

// ── Single seam for every LLM call (roadmap G3) ──────────────────────────────
// Model ids used to be hardcoded at ~10 call sites with no timeout and no retry,
// so a hung provider blocked the whole request and swapping models meant a
// find-and-replace. callModel() centralizes the model choice (by purpose or
// env), a hard timeout, and bounded retry. It returns the raw ChatCompletion so
// callers read `.choices` / `.usage` exactly as before, still gate on
// OPENAI_API_KEY (getOpenAI throws otherwise), and still own their fallback.

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

/** Default model, overridable globally via OPENAI_MODEL. */
const DEFAULT_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

/** Resolve the model for a purpose: OPENAI_MODEL_<PURPOSE> wins, else the default. */
function modelFor(purpose: ModelPurpose): string {
  const override = process.env[`OPENAI_MODEL_${purpose.toUpperCase()}`]?.trim();
  return override || DEFAULT_MODEL;
}

const num = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

const DEFAULT_TIMEOUT_MS = num(process.env.OPENAI_TIMEOUT_MS, 20_000);
const DEFAULT_MAX_RETRIES = num(process.env.OPENAI_MAX_RETRIES, 2);

export type CallModelOpts = Omit<ChatCompletionCreateParamsNonStreaming, "model" | "stream"> & {
  /** Routes to a model via env override; defaults to the shared model. */
  purpose?: ModelPurpose;
  /** Explicit model id — wins over `purpose`. */
  model?: string;
  /** Abort the call after this many ms (default 20s / OPENAI_TIMEOUT_MS). */
  timeoutMs?: number;
  /** Bounded retries on 429 / 5xx / network errors (default 2 / OPENAI_MAX_RETRIES). */
  maxRetries?: number;
  /** Caller-provided cancellation. */
  signal?: AbortSignal;
};

/**
 * Central chat-completion call. Returns the raw ChatCompletion so callers read
 * `.choices` / `.usage` unchanged.
 */
export async function callModel(opts: CallModelOpts): Promise<ChatCompletion> {
  const { purpose = "default", model, timeoutMs, maxRetries, signal, ...body } = opts;
  const params: ChatCompletionCreateParamsNonStreaming = {
    ...body,
    model: model || modelFor(purpose),
    stream: false,
  };
  return getOpenAI().chat.completions.create(params, {
    timeout: timeoutMs ?? DEFAULT_TIMEOUT_MS,
    maxRetries: maxRetries ?? DEFAULT_MAX_RETRIES,
    signal,
  });
}
