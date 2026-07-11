import { getServiceClient } from "@/lib/supabase-server";
import { redactPII } from "@/lib/guardrails";

type Span = { name: string; ms: number; data?: Record<string, unknown> };

/**
 * Lightweight, best-effort agent tracer. Records the spans of one agent
 * invocation (guardrails, model call, parse, decision) with timings, token
 * usage, redacted input/output, and flags — then flushes one row to the
 * `traces` table. No-ops when Supabase is unconfigured, so it's free in demo.
 *
 * Purpose: debug a single decision post-hoc, and mine real traffic into golden
 * eval sets (see /api/admin/traces?format=eval).
 */
export class Trace {
  private spans: Span[] = [];
  private flags: Record<string, unknown> = {};
  private t0 = Date.now();
  private input: string | null = null;
  private output: string | null = null;
  private tokens = 0;
  private status = "ok";

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

  async end(): Promise<void> {
    const supabase = getServiceClient();
    if (!supabase) return;
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
      });
    } catch {
      /* tracing must never break the request */
    }
  }
}

export function startTrace(route: string, sessionId?: string): Trace {
  return new Trace(route, sessionId);
}
