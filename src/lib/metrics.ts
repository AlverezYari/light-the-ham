/**
 * Prometheus Metrics for Light the Ham!
 *
 * Exposes metrics in Prometheus format for VictoriaMetrics scraping.
 * Includes HTTP request metrics and app-specific business metrics.
 */

import { Counter, collectDefaultMetrics, Gauge, Histogram, Registry } from 'prom-client';

// Create a custom registry (allows us to control what's exposed)
export const registry = new Registry();

// Add default Node.js metrics (CPU, memory, event loop, etc.)
collectDefaultMetrics({ register: registry });

// ============================================================
// HTTP METRICS
// ============================================================

/**
 * Total HTTP requests by route, method, and status code
 */
export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [registry],
});

/**
 * HTTP request duration in seconds
 */
export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [registry],
});

/**
 * Currently active HTTP requests
 */
export const httpRequestsActive = new Gauge({
  name: 'http_requests_active',
  help: 'Number of active HTTP requests',
  registers: [registry],
});

// ============================================================
// BUSINESS METRICS
// ============================================================

/**
 * Properties submitted (before moderation)
 */
export const propertiesSubmitted = new Counter({
  name: 'lth_properties_submitted_total',
  help: 'Total properties submitted',
  labelNames: ['city'] as const,
  registers: [registry],
});

/**
 * Properties approved by moderators
 */
export const propertiesApproved = new Counter({
  name: 'lth_properties_approved_total',
  help: 'Total properties approved',
  registers: [registry],
});

/**
 * Ratings submitted
 */
export const ratingsSubmitted = new Counter({
  name: 'lth_ratings_submitted_total',
  help: 'Total ratings submitted',
  labelNames: ['rating'] as const,
  registers: [registry],
});

/**
 * Photos uploaded
 */
export const photosUploaded = new Counter({
  name: 'lth_photos_uploaded_total',
  help: 'Total photos uploaded',
  registers: [registry],
});

/**
 * Tips submitted
 */
export const tipsSubmitted = new Counter({
  name: 'lth_tips_submitted_total',
  help: 'Total tips submitted',
  registers: [registry],
});

/**
 * Tours created
 */
export const toursCreated = new Counter({
  name: 'lth_tours_created_total',
  help: 'Total tours created',
  registers: [registry],
});

/**
 * Ownership claims
 */
export const claimsSubmitted = new Counter({
  name: 'lth_claims_submitted_total',
  help: 'Total ownership claims submitted',
  labelNames: ['type'] as const, // 'approved' or 'disputed'
  registers: [registry],
});

/**
 * User logins
 */
export const userLogins = new Counter({
  name: 'lth_user_logins_total',
  help: 'Total user logins',
  labelNames: ['provider'] as const, // currently only 'google'; extend if more providers are added
  registers: [registry],
});

/**
 * Active sessions (approximate)
 */
export const activeSessions = new Gauge({
  name: 'lth_active_sessions',
  help: 'Approximate number of active sessions',
  registers: [registry],
});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Normalize route paths for metrics (remove IDs, slugs, etc.)
 * e.g., /properties/abc123 -> /properties/:id
 */
export function normalizeRoute(path: string): string {
  return (
    path
      // Property IDs (UUIDs)
      .replace(/\/properties\/[a-f0-9-]{36}/gi, '/properties/:id')
      // Tour slugs
      .replace(/\/tours\/[a-z0-9-]+/gi, '/tours/:slug')
      // Upload paths
      .replace(/\/uploads\/.+/gi, '/uploads/:path')
      // Generic UUID pattern
      .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, ':uuid')
      // Clean up any double slashes
      .replace(/\/+/g, '/')
  );
}
