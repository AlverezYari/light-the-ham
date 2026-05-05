/**
 * Resolve the real client IP behind Cloudflare Tunnel.
 *
 * Production traffic flows: client -> Cloudflare edge -> Cloudflare Tunnel pod
 * (in cluster) -> our app. By the time it reaches Astro, `context.clientAddress`
 * is the tunnel pod's internal IP, which is useless for per-visitor rate limiting.
 *
 * Cloudflare always sets `CF-Connecting-IP` to the original client. We trust it
 * here because the only ingress path is via the tunnel (NetworkPolicy enforces
 * this). For local dev there's no Cloudflare in front, so we fall back to
 * `X-Forwarded-For` and finally to whatever the adapter gave us.
 */
export function getClientIp(request: Request, fallback?: string): string {
  const cf = request.headers.get('cf-connecting-ip');
  if (cf) return cf;

  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    // X-Forwarded-For is "client, proxy1, proxy2" — first entry is the client.
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }

  return fallback || 'unknown';
}
