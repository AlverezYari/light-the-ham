/**
 * CSRF protection via Origin / Referer header validation.
 *
 * SameSite=Lax cookies already block most CSRF (cross-site POSTs don't carry
 * session cookies), but defense-in-depth: we also reject mutations whose
 * Origin/Referer doesn't match an allowed origin. No tokens, no forms to
 * rewrite — just a header check at the edge of the app.
 *
 * Routes that legitimately receive cross-origin POSTs (none today; Apple's
 * form_post callback would go here if Apple OAuth were re-introduced) must
 * be in CSRF_EXEMPT_PATHS — they should have their own anti-forgery (e.g.
 * an OAuth state token) checked inside the handler.
 */

export const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const CSRF_EXEMPT_PATHS = new Set<string>([]);

function safeOrigin(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Returns true if `origin` or `referer` matches one of the `allowed` origins.
 * Both inputs may be null (some browsers omit Origin on same-origin GETs);
 * we require at least one to match.
 */
export function isOriginAllowed(
  origin: string | null,
  referer: string | null,
  allowed: string[],
): boolean {
  const allowedOrigins = new Set(allowed.map(safeOrigin).filter((x): x is string => x !== null));
  const o = safeOrigin(origin);
  const r = safeOrigin(referer);
  if (o && allowedOrigins.has(o)) return true;
  if (r && allowedOrigins.has(r)) return true;
  return false;
}

function getEnv(key: string): string {
  return import.meta.env?.[key] || process.env[key] || '';
}

export function getAllowedOrigins(): string[] {
  const siteUrl = getEnv('SITE_URL');
  // Always include the dev server so `task dev` doesn't need any configuration.
  const dev = 'http://localhost:4321';
  return siteUrl ? [siteUrl, dev] : [dev];
}

/**
 * Pure entrypoint used by middleware. Returns null if the request is allowed,
 * or a Response (403) to short-circuit if it's not.
 */
export function csrfCheck(request: Request, allowedOrigins: string[]): Response | null {
  if (SAFE_METHODS.has(request.method)) return null;

  const url = new URL(request.url);
  if (CSRF_EXEMPT_PATHS.has(url.pathname)) return null;

  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  if (isOriginAllowed(origin, referer, allowedOrigins)) return null;

  return new Response(JSON.stringify({ error: 'CSRF check failed' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}
