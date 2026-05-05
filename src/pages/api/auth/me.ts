/**
 * Get Current User - GET /api/auth/me
 *
 * Returns the currently logged in user, or null if not authenticated.
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { getSessionFromCookies, validateSession } from '../../../lib/auth';

export const GET: APIRoute = async ({ request }) => {
  const cookieHeader = request.headers.get('cookie');
  const sessionToken = getSessionFromCookies(cookieHeader);

  if (!sessionToken) {
    return new Response(JSON.stringify({ user: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const result = await validateSession(sessionToken);

  if (!result) {
    return new Response(JSON.stringify({ user: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Return user info (excluding sensitive fields)
  return new Response(
    JSON.stringify({
      user: {
        id: result.user.id,
        email: result.user.email,
        displayName: result.user.displayName,
        avatarUrl: result.user.avatarUrl,
        role: result.user.role,
        isTrusted: result.user.isTrusted,
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  );
};
