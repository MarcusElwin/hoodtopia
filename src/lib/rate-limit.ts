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

// Force a sweep once the Map grows past this many entries, even within the
// time window, so a burst of distinct keys can't balloon memory before the
// next scheduled sweep.
const MAX_BUCKETS_BEFORE_SWEEP = 10_000;

// Drop expired buckets so the Map can't grow unbounded under a flood of
// distinct keys. Runs at most once a minute, or immediately when the Map is
// large.
function sweep(now: number): void {
  if (now - lastSweep < 60_000 && buckets.size < MAX_BUCKETS_BEFORE_SWEEP) return;
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
