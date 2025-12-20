/**
 * Astro Middleware
 *
 * Tracks HTTP request metrics for Prometheus/VictoriaMetrics.
 */

import { defineMiddleware } from 'astro:middleware';
import {
  httpRequestsTotal,
  httpRequestDuration,
  httpRequestsActive,
  normalizeRoute,
} from './lib/metrics';

export const onRequest = defineMiddleware(async (context, next) => {
  const start = performance.now();
  const method = context.request.method;
  const path = new URL(context.request.url).pathname;

  // Skip metrics endpoint itself to avoid recursion
  if (path === '/metrics') {
    return next();
  }

  // Track active requests
  httpRequestsActive.inc();

  try {
    const response = await next();
    const duration = (performance.now() - start) / 1000; // Convert to seconds
    const route = normalizeRoute(path);
    const statusCode = response.status.toString();

    // Record metrics
    httpRequestsTotal.inc({ method, route, status_code: statusCode });
    httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);

    return response;
  } catch (error) {
    const duration = (performance.now() - start) / 1000;
    const route = normalizeRoute(path);

    // Record error metrics
    httpRequestsTotal.inc({ method, route, status_code: '500' });
    httpRequestDuration.observe({ method, route, status_code: '500' }, duration);

    throw error;
  } finally {
    httpRequestsActive.dec();
  }
});
