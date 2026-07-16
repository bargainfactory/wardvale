// Per-key token budget. Bounds inference spend/abuse beyond the request-rate
// limit: an attacker (or a runaway loop) can't burn unlimited OpenAI tokens.
// Per-instance in-memory daily window — adequate as a spend ceiling; move to
// Upstash for a global cap if needed.

type Bucket = { tokens: number; reset: number };
const buckets = new Map<string, Bucket>();
const DAY_MS = 24 * 60 * 60 * 1000;

/** True if this key has already spent its daily token allowance. */
export function overBudget(key: string, dailyCap: number): boolean {
  const b = buckets.get(key);
  if (!b || Date.now() > b.reset) return false;
  return b.tokens >= dailyCap;
}

/** Record tokens spent against a key's daily window. */
export function recordTokens(key: string, tokens: number): void {
  if (!tokens || tokens < 0) return;
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || now > b.reset) buckets.set(key, { tokens, reset: now + DAY_MS });
  else b.tokens += tokens;
}

// Per-IP daily ceiling for the public AI endpoints. Env-configurable because the
// right value depends heavily on the model: a reasoning model (Grok 4.5) emits
// hidden reasoning tokens billed as output, so the same interview costs far more
// than it did on gpt-4o-mini AND a legitimate user hits the old 200k much sooner.
// Default raised so real usage isn't silently downgraded to the scripted flow;
// override via DAILY_TOKEN_CAP for tighter spend control.
export const DAILY_TOKEN_CAP = Number(process.env.DAILY_TOKEN_CAP) || 500_000;

// Global daily ceiling across ALL lanes (enforced centrally in lib/model.ts), so
// server-side spenders (agent runtime, judge cron, MCP) that have no per-IP key
// still have a hard spend backstop. Per-instance in-memory like the rest — set
// Upstash for a true global cap. Override via GLOBAL_DAILY_TOKEN_CAP.
export const GLOBAL_DAILY_TOKEN_CAP = Number(process.env.GLOBAL_DAILY_TOKEN_CAP) || 3_000_000;
