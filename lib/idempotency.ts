// Best-effort idempotency for side-effecting actions (send email, insert run),
// so a double-submit or webhook retry doesn't fire the action twice. Per-
// instance in-memory with a TTL; pair with provider-level idempotency keys
// (e.g. Stripe) for hard guarantees.

const seen = new Map<string, number>();

/** Returns true the first time a key is seen within the TTL, false thereafter. */
export function firstTime(key: string, ttlMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  if (seen.size > 5000) {
    for (const [k, exp] of seen) if (now > exp) seen.delete(k);
  }
  const exp = seen.get(key);
  if (exp && now < exp) return false;
  seen.set(key, now + ttlMs);
  return true;
}

/** Build a stable idempotency key from parts. */
export function idemKey(...parts: (string | number | undefined)[]): string {
  return parts.filter((p) => p !== undefined && p !== "").join("|").slice(0, 240);
}
