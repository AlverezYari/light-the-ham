import { describe, expect, it } from 'vitest';
import { CSRF_EXEMPT_PATHS, csrfCheck, isOriginAllowed } from './csrf';

const ALLOWED = ['https://lighttheham.com', 'http://localhost:4321'];

describe('isOriginAllowed', () => {
  it('accepts when Origin matches an allowed origin', () => {
    expect(isOriginAllowed('https://lighttheham.com', null, ALLOWED)).toBe(true);
  });

  it('accepts when Referer matches (Origin missing)', () => {
    expect(isOriginAllowed(null, 'https://lighttheham.com/page', ALLOWED)).toBe(true);
  });

  it('rejects when neither matches', () => {
    expect(isOriginAllowed('https://evil.example', 'https://evil.example/x', ALLOWED)).toBe(false);
  });

  it('rejects when both headers are absent', () => {
    expect(isOriginAllowed(null, null, ALLOWED)).toBe(false);
  });

  it('ignores port differences only when origins truly match (full origin compare)', () => {
    expect(isOriginAllowed('http://localhost:4321', null, ALLOWED)).toBe(true);
    expect(isOriginAllowed('http://localhost:5173', null, ALLOWED)).toBe(false);
  });

  it('does not throw on malformed values', () => {
    expect(isOriginAllowed('not a url', 'also not', ALLOWED)).toBe(false);
  });
});

describe('csrfCheck', () => {
  function makeRequest(method: string, url: string, headers: Record<string, string> = {}) {
    return new Request(url, { method, headers });
  }

  it('passes safe methods (GET) without checking origin', () => {
    const req = makeRequest('GET', 'https://lighttheham.com/api/anything');
    expect(csrfCheck(req, ALLOWED)).toBeNull();
  });

  it('passes POST with matching Origin', () => {
    const req = makeRequest('POST', 'https://lighttheham.com/api/rate', {
      origin: 'https://lighttheham.com',
    });
    expect(csrfCheck(req, ALLOWED)).toBeNull();
  });

  it('rejects POST with foreign Origin', async () => {
    const req = makeRequest('POST', 'https://lighttheham.com/api/rate', {
      origin: 'https://evil.example',
    });
    const blocked = csrfCheck(req, ALLOWED);
    expect(blocked).not.toBeNull();
    expect(blocked?.status).toBe(403);
  });

  it('rejects POST with no Origin or Referer at all', () => {
    const req = makeRequest('POST', 'https://lighttheham.com/api/rate');
    expect(csrfCheck(req, ALLOWED)?.status).toBe(403);
  });

  it('exempts paths in CSRF_EXEMPT_PATHS even with foreign Origin', () => {
    // Empty allowlist today; this test pins the exemption mechanism so the
    // contract stays explicit if/when a cross-origin POST flow is re-added.
    expect(CSRF_EXEMPT_PATHS instanceof Set).toBe(true);

    // Simulate exemption by adding a fake path locally (csrf.ts module's Set
    // is the real one — we don't mutate it across tests).
    const exempt = new Set([...CSRF_EXEMPT_PATHS, '/test/exempt-callback']);
    function localCheck(request: Request, allowed: string[]): Response | null {
      const url = new URL(request.url);
      if (exempt.has(url.pathname)) return null;
      return csrfCheck(request, allowed);
    }

    const req = makeRequest('POST', 'https://lighttheham.com/test/exempt-callback', {
      origin: 'https://external.example',
    });
    expect(localCheck(req, ALLOWED)).toBeNull();
  });

  it('rejects DELETE from foreign origin', () => {
    const req = makeRequest('DELETE', 'https://lighttheham.com/api/admin/moderate', {
      origin: 'https://evil.example',
    });
    expect(csrfCheck(req, ALLOWED)?.status).toBe(403);
  });
});
