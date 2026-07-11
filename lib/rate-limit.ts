export type RateResult = { ok: boolean; remaining: number; retryAfter: number };

// Durable, cross-instance rate limiting via Upstash Redis (REST, no SDK) when
// configured; falls back to a per-instance in-memory limiter otherwise. Async
// so the Upstash round-trip can be awaited.
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      return await upstashLimit(url, token, key, limit, windowMs);
    } catch {
      // Fail open to memory on any transient Upstash error.
    }
  }
  return memoryLimit(key, limit, windowMs);
}

async function upstashLimit(
  url: string,
  token: string,
  key: string,
  limit: number,
  windowMs: number
): Promise<RateResult> {
  // Fixed window: INCR, set TTL only on first hit (NX), read remaining TTL.
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify([
      ["INCR", key],
      ["PEXPIRE", key, windowMs, "NX"],
      ["PTTL", key],
    ]),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const data = (await res.json()) as { result: number }[];
  const count = Number(data[0]?.result ?? 0);
  const pttl = Number(data[2]?.result ?? windowMs);
  const retryAfter = pttl > 0 ? Math.ceil(pttl / 1000) : Math.ceil(windowMs / 1000);
  if (count > limit) return { ok: false, remaining: 0, retryAfter };
  return { ok: true, remaining: Math.max(0, limit - count), retryAfter: 0 };
}

type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

function memoryLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
  }
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }
  if (bucket.count >= limit) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((bucket.reset - now) / 1000) };
  }
  bucket.count++;
  return { ok: true, remaining: limit - bucket.count, retryAfter: 0 };
}

/** Best-effort client IP from proxy headers. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") || "unknown";
}
