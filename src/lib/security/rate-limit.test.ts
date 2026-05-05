import { describe, expect, it } from 'vitest';
import { isRateLimitedPath, TokenBucketLimiter } from './rate-limit';

describe('isRateLimitedPath', () => {
  it('matches the exact mutation paths', () => {
    expect(isRateLimitedPath('/api/rate')).toBe(true);
    expect(isRateLimitedPath('/api/submit')).toBe(true);
    expect(isRateLimitedPath('/api/photos/upload')).toBe(true);
  });

  it('matches sub-paths under a limited prefix', () => {
    expect(isRateLimitedPath('/api/photos/upload/anything')).toBe(true);
  });

  it('does not match unrelated paths', () => {
    expect(isRateLimitedPath('/api/properties')).toBe(false);
    expect(isRateLimitedPath('/api/auth/google')).toBe(false);
    expect(isRateLimitedPath('/')).toBe(false);
  });

  it('does not over-match a different path with a limited path as prefix-substring', () => {
    // /api/ratelimit-test should NOT be considered limited because of /api/rate.
    expect(isRateLimitedPath('/api/ratelimit-test')).toBe(false);
  });
});

describe('TokenBucketLimiter', () => {
  it('allows up to capacity then blocks further requests at the same instant', () => {
    const now = 1000;
    const limiter = new TokenBucketLimiter({ capacity: 3, refillPerSecond: 1 }, () => now);

    expect(limiter.consume('alice')).toBe(true);
    expect(limiter.consume('alice')).toBe(true);
    expect(limiter.consume('alice')).toBe(true);
    expect(limiter.consume('alice')).toBe(false);
  });

  it('refills tokens over time at refillPerSecond', () => {
    let now = 1000;
    const limiter = new TokenBucketLimiter({ capacity: 2, refillPerSecond: 1 }, () => now);

    limiter.consume('alice');
    limiter.consume('alice');
    expect(limiter.consume('alice')).toBe(false);

    now += 1.5; // 1.5 seconds → 1.5 tokens added (capped at 2)
    expect(limiter.consume('alice')).toBe(true); // first refilled token available
    expect(limiter.consume('alice')).toBe(false); // only 0.5 tokens remain (< 1)
  });

  it('caps refill at capacity (no infinite accumulation)', () => {
    let now = 1000;
    const limiter = new TokenBucketLimiter({ capacity: 3, refillPerSecond: 10 }, () => now);

    limiter.consume('alice'); // bucket now at 2
    now += 1000; // a thousand seconds idle — could "earn" 10000 tokens

    // Capacity is 3; we should only get back to 3.
    expect(limiter.consume('alice')).toBe(true); // 3 -> 2
    expect(limiter.consume('alice')).toBe(true); // 2 -> 1
    expect(limiter.consume('alice')).toBe(true); // 1 -> 0
    expect(limiter.consume('alice')).toBe(false);
  });

  it('keeps separate buckets per key (no bleed across IPs)', () => {
    const now = 1000;
    const limiter = new TokenBucketLimiter({ capacity: 1, refillPerSecond: 0 }, () => now);

    expect(limiter.consume('alice')).toBe(true);
    expect(limiter.consume('alice')).toBe(false);
    expect(limiter.consume('bob')).toBe(true); // bob's bucket is fresh
    expect(limiter.consume('bob')).toBe(false);
  });
});
