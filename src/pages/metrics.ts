/**
 * Prometheus Metrics Endpoint - GET /metrics
 *
 * Exposes metrics in Prometheus format for VictoriaMetrics scraping.
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { registry } from '../lib/metrics';

export const GET: APIRoute = async () => {
  try {
    const metrics = await registry.metrics();

    return new Response(metrics, {
      status: 200,
      headers: {
        'Content-Type': registry.contentType,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error generating metrics:', error);
    return new Response('Error generating metrics', { status: 500 });
  }
};
