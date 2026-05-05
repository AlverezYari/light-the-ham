/**
 * Astro middleware chain.
 *
 * Order matters: security checks run first (cheap, may short-circuit), then
 * the metrics wrapper times whatever made it through. Each layer is its own
 * defineMiddleware, composed via sequence() so a 403/429 from a security
 * layer skips the rest cleanly.
 */

import { defineMiddleware, sequence } from 'astro:middleware';
import {
  httpRequestDuration,
  httpRequestsActive,
  httpRequestsTotal,
  normalizeRoute,
} from './lib/metrics';
import { getClientIp } from './lib/security/client-ip';
import { csrfCheck, getAllowedOrigins } from './lib/security/csrf';
import { defaultLimiter, isRateLimitedPath } from './lib/security/rate-limit';

const csrfMiddleware = defineMiddleware(async ({ request }, next) => {
  const blocked = csrfCheck(request, getAllowedOrigins());
  return blocked ?? next();
});

const rateLimitMiddleware = defineMiddleware(async ({ request, clientAddress }, next) => {
  const url = new URL(request.url);
  if (!isRateLimitedPath(url.pathname)) return next();

  const ip = getClientIp(request, clientAddress);
  const key = `${ip}:${url.pathname}`;

  if (!defaultLimiter.consume(key)) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
    });
  }
  return next();
});

const metricsMiddleware = defineMiddleware(async (context, next) => {
  const start = performance.now();
  const method = context.request.method;
  const path = new URL(context.request.url).pathname;

  // Skip metrics endpoint itself to avoid recursion
  if (path === '/metrics') {
    return next();
  }

  httpRequestsActive.inc();

  try {
    const response = await next();
    const duration = (performance.now() - start) / 1000;
    const route = normalizeRoute(path);
    const statusCode = response.status.toString();

    httpRequestsTotal.inc({ method, route, status_code: statusCode });
    httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);

    return response;
  } catch (error) {
    const duration = (performance.now() - start) / 1000;
    const route = normalizeRoute(path);

    httpRequestsTotal.inc({ method, route, status_code: '500' });
    httpRequestDuration.observe({ method, route, status_code: '500' }, duration);

    throw error;
  } finally {
    httpRequestsActive.dec();
  }
});

export const onRequest = sequence(csrfMiddleware, rateLimitMiddleware, metricsMiddleware);
