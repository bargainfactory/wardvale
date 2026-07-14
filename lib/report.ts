import { getServiceClient } from "@/lib/supabase-server";
import { redactPII } from "@/lib/guardrails";

// ── Central error / degradation sink (roadmap G6) ────────────────────────────
// The codebase is deliberately resilient: pervasive `catch {}` keeps a request
// alive when a dependency hiccups. That resilience also made failures invisible
// — a connector returning 0 rows because its token expired looked exactly like
// one with nothing to do. reportError / reportWarning give those swallowed
// failures a voice WITHOUT changing the control flow: call it, then continue.
// It never throws.
//
// Sinks, each best-effort and independent:
//   1. structured console  (always, synchronous, PII-redacted)  ← guaranteed capture
//   2. a webhook           (ERROR_WEBHOOK_URL — Slack-incoming-webhook shaped)
//   3. the error_events    table (when Supabase is configured — in-app/ops history)

export type Level = "warning" | "error";
export type ReportContext = {
  source?: string; // route or module, e.g. "agent.run" | "pull.shopify"
  clientId?: string;
  detail?: Record<string, unknown>;
};

const clip = (s: string, n: number): string => (s.length > n ? s.slice(0, n) : s);

function fingerprint(level: Level, source: string, message: string): string {
  return clip(`${level}:${source}:${message}`, 200);
}

function normalize(err: unknown): string {
  if (err instanceof Error) return redactPII(`${err.name}: ${err.message}`);
  if (typeof err === "string") return redactPII(err);
  try {
    return redactPII(clip(JSON.stringify(err), 500));
  } catch {
    return "unknown error";
  }
}

async function toWebhook(level: Level, source: string, message: string): Promise<void> {
  const url = process.env.ERROR_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: `[FlowForge ${level}] ${source}: ${message}` }),
      cache: "no-store",
    });
  } catch {
    /* the alerter must never break the caller */
  }
}

async function toTable(level: Level, source: string, message: string, ctx: ReportContext): Promise<void> {
  const supabase = getServiceClient();
  if (!supabase) return;
  try {
    await supabase.from("error_events").insert({
      level,
      source,
      message: clip(message, 500),
      client_id: ctx.clientId ?? null,
      detail: ctx.detail ?? {},
      fingerprint: fingerprint(level, source, message),
    });
  } catch {
    /* non-critical — never fail an operation because logging hiccuped */
  }
}

function emit(level: Level, message: string, ctx: ReportContext): void {
  const source = ctx.source ?? "app";
  // 1. structured console — synchronous, the guaranteed capture.
  const line = JSON.stringify({ level, source, message, clientId: ctx.clientId, ...ctx.detail });
  if (level === "error") console.error("[report]", line);
  else console.warn("[report]", line);
  // 2 + 3. external sinks — fire-and-forget so the caller's flow is untouched.
  void toWebhook(level, source, message);
  void toTable(level, source, message, ctx);
}

/** A degraded-but-survived condition: a fallback fired, a connector failed to a safe empty. */
export function reportWarning(message: string, ctx: ReportContext = {}): void {
  emit("warning", message, ctx);
}

/** A failure that broke the operation (a request 500, an unrecoverable error). */
export function reportError(err: unknown, ctx: ReportContext = {}): void {
  emit("error", normalize(err), ctx);
}
