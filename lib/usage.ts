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

// Generous daily ceiling per IP for the public AI endpoints (gpt-4o-mini is
// cheap; this caps the tail, not normal use).
export const DAILY_TOKEN_CAP = 200_000;
