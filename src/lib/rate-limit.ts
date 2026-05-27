import "server-only";

// Lightweight in-memory fixed-window rate limiter. Best-effort only: on
// serverless platforms each warm instance keeps its own counters, so this
// bounds abuse per instance rather than globally. A strict global limit would
// need a shared store (Redis / Upstash) — out of scope for the demo, matching
// the in-memory shipment-store precedent. It still meaningfully throttles a
// single client hammering the paid LLM / image endpoints.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

// Drop expired buckets occasionally so the Map can't grow unbounded under a
// flood of distinct keys (e.g. spoofed X-Forwarded-For values).
function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || now >= existing.resetAt) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt };
  }

  if (existing.count >= limit) {
    return { ok: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return {
    ok: true,
    remaining: limit - existing.count,
    resetAt: existing.resetAt,
  };
}
