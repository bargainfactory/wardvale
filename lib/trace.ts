import { getServiceClient } from "@/lib/supabase-server";
import { redactPII } from "@/lib/guardrails";

type Span = { name: string; ms: number; data?: Record<string, unknown> };

/** Trace sampling rate in [0,1] from TRACE_SAMPLE_RATE (default 1 = keep all). */
function sampleRate(): number {
  const r = Number(process.env.TRACE_SAMPLE_RATE);
  if (!Number.isFinite(r)) return 1;
  return Math.min(1, Math.max(0, r));
}

/**
 * Whether a finished trace should be persisted (roadmap G7). INTERESTING traces
 * — errors, prompt-injections, connector failures, model fallbacks — are ALWAYS
 * kept; ordinary traces are sampled at `rate` so the table (and its write cost
 * on the hot path) can't grow unbounded. Pure + injectable for testing.
 */
export function shouldPersistTrace(
  status: string,
  flags: Record<string, unknown>,
  rand: number,
  rate: number
): boolean {
  if (status !== "ok") return true;
  if (flags.injection === true) return true;
  if (flags.source_error) return true;
  if (flags.mode === "heuristic-fallback") return true;
  return rand < rate;
}

/**
 * Lightweight, best-effort agent tracer. Records the spans of one agent
 * invocation (guardrails, model call, parse, decision) with timings, token
 * usage, redacted input/output, flags, and the prompt version that produced it —
 * then persists one sampled row to the `traces` table. No-ops when Supabase is
 * unconfigured, so it's free in demo.
 *
 * Purpose: debug a single decision post-hoc, and mine real traffic into golden
 * eval sets (see /api/admin/traces?format=eval) attributable to a prompt version.
 */
export class Trace {
  private spans: Span[] = [];
  private flags: Record<string, unknown> = {};
  private t0 = Date.now();
  private input: string | null = null;
  private output: string | null = null;
  private tokens = 0;
  private status = "ok";
  private promptVersion: string | null = null;

  constructor(private route: string, private sessionId?: string) {}

  /** Record a point-in-time span with the elapsed offset from trace start. */
  mark(name: string, data?: Record<string, unknown>): void {
    this.spans.push({ name, ms: Date.now() - this.t0, data });
  }
  flag(key: string, value: unknown): void {
    this.flags[key] = value;
  }
  setInput(s: string): void {
    this.input = redactPII((s ?? "").slice(0, 4000));
  }
  setOutput(s: string): void {
    this.output = redactPII((s ?? "").slice(0, 4000));
  }
  setTokens(n: number | undefined): void {
    this.tokens = n && n > 0 ? n : 0;
  }
  setStatus(s: string): void {
    this.status = s;
  }
  /** Record which prompt version produced this decision (see lib/prompts.ts). */
  setPrompt(version: string | null | undefined): void {
    this.promptVersion = version ?? null;
  }

  async end(): Promise<void> {
    const supabase = getServiceClient();
    if (!supabase) return;
    // Sampled + always-keep-interesting so the table can't grow unbounded.
    if (!shouldPersistTrace(this.status, this.flags, Math.random(), sampleRate())) return;
    try {
      await supabase.from("traces").insert({
        route: this.route,
        session_id: this.sessionId ?? null,
        status: this.status,
        latency_ms: Date.now() - this.t0,
        tokens: this.tokens,
        input: this.input,
        output: this.output,
        spans: this.spans,
        flags: this.flags,
        prompt_version: this.promptVersion,
      });
    } catch {
      /* tracing must never break the request */
    }
  }
}

export function startTrace(route: string, sessionId?: string): Trace {
  return new Trace(route, sessionId);
}
