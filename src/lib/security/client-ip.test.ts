import { describe, expect, it } from 'vitest';
import { getClientIp } from './client-ip';

function req(headers: Record<string, string>) {
  return new Request('http://x/', { headers });
}

describe('getClientIp', () => {
  it('prefers CF-Connecting-IP when present (production path through Cloudflare Tunnel)', () => {
    expect(getClientIp(req({ 'cf-connecting-ip': '203.0.113.5' }), '10.0.0.1')).toBe('203.0.113.5');
  });

  it('falls back to the first entry of X-Forwarded-For', () => {
    expect(getClientIp(req({ 'x-forwarded-for': '203.0.113.5, 10.0.0.1' }), '10.0.0.1')).toBe(
      '203.0.113.5',
    );
  });

  it('falls back to the adapter-provided clientAddress when no headers', () => {
    expect(getClientIp(req({}), '127.0.0.1')).toBe('127.0.0.1');
  });

  it("returns 'unknown' if there is nothing to use", () => {
    expect(getClientIp(req({}))).toBe('unknown');
  });

  it('CF-Connecting-IP wins over X-Forwarded-For (defense against header injection ambiguity)', () => {
    expect(
      getClientIp(
        req({
          'cf-connecting-ip': '203.0.113.5',
          'x-forwarded-for': '198.51.100.99',
        }),
      ),
    ).toBe('203.0.113.5');
  });
});
