/**
 * Minimal in-memory fixed-window rate limiter (per API instance). Enough to
 * blunt abuse of public endpoints; swap for a Redis-backed limiter if the API
 * is ever horizontally scaled.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Returns true if the request under `key` is within `max` per `windowMs`. */
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    // Opportunistic prune so the map can't grow unbounded.
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (now > b.resetAt) buckets.delete(k);
    }
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count += 1;
  return true;
}
