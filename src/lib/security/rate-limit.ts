/**
 * In-memory token-bucket rate limiter, keyed by client IP + route prefix.
 *
 * Single-replica caveat: the bucket lives in this process. Restarts reset
 * counters; horizontal scale-out would let an abuser round-robin across
 * replicas. Both are acceptable for current scale (1 replica, low traffic).
 * If/when we move to >1 replica, replace this with Redis or move the check
 * into a sidecar (e.g. envoy ratelimit). Documented in RUNBOOK.
 */

export interface RateLimitConfig {
  /** Max tokens the bucket can hold (also the burst allowance). */
  capacity: number;
  /** Tokens added per second when the bucket is below capacity. */
  refillPerSecond: number;
}

interface Bucket {
  tokens: number;
  lastRefillSec: number;
}

export class TokenBucketLimiter {
  private buckets = new Map<string, Bucket>();
  constructor(
    private readonly config: RateLimitConfig,
    private readonly now: () => number = () => Date.now() / 1000,
  ) {}

  /**
   * Consume 1 token for `key`. Returns true if allowed, false if rate-limited.
   * The bucket is lazily created on first hit and lazily refilled on each call.
   */
  consume(key: string): boolean {
    const t = this.now();
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { tokens: this.config.capacity, lastRefillSec: t };
      this.buckets.set(key, bucket);
    } else {
      const elapsed = t - bucket.lastRefillSec;
      bucket.tokens = Math.min(
        this.config.capacity,
        bucket.tokens + elapsed * this.config.refillPerSecond,
      );
      bucket.lastRefillSec = t;
    }

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }
    return false;
  }

  /** For tests — wipe all state. */
  reset(): void {
    this.buckets.clear();
  }

  /** For tests / introspection — current token count, or null if no bucket yet. */
  peek(key: string): number | null {
    return this.buckets.get(key)?.tokens ?? null;
  }
}

// Default limit for the mutation routes:
//   30 requests/minute, burst of 30.
// Generous enough that real users won't hit it; tight enough that a script
// hammering the endpoint gets throttled within ~30 hits.
export const DEFAULT_LIMIT: RateLimitConfig = {
  capacity: 30,
  refillPerSecond: 30 / 60,
};

// Routes the limiter applies to. Match by exact path or path-prefix
// (so /api/photos/upload/anything still hits photos/upload's bucket).
export const RATE_LIMITED_PATHS: readonly string[] = [
  '/api/rate',
  '/api/submit',
  '/api/upload',
  '/api/photos/upload',
  '/api/tips/submit',
  '/api/claims/submit',
];

export function isRateLimitedPath(pathname: string): boolean {
  return RATE_LIMITED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Module-singleton bucket used by the middleware. Tests can construct their own.
export const defaultLimiter = new TokenBucketLimiter(DEFAULT_LIMIT);
