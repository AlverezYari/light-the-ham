/**
 * Logout - POST /api/auth/logout
 *
 * Deletes the session and clears the cookie.
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { createLogoutCookie, deleteSession, getSessionFromCookies } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, redirect }) => {
  const cookieHeader = request.headers.get('cookie');
  const sessionToken = getSessionFromCookies(cookieHeader);

  if (sessionToken) {
    await deleteSession(sessionToken);
  }

  const headers = new Headers();
  headers.append('Set-Cookie', createLogoutCookie());
  headers.append('Location', '/');

  return new Response(null, {
    status: 302,
    headers,
  });
};

// Also allow GET for simple logout links
export const GET: APIRoute = async ({ request, redirect }) => {
  const cookieHeader = request.headers.get('cookie');
  const sessionToken = getSessionFromCookies(cookieHeader);

  if (sessionToken) {
    await deleteSession(sessionToken);
  }

  const headers = new Headers();
  headers.append('Set-Cookie', createLogoutCookie());
  headers.append('Location', '/');

  return new Response(null, {
    status: 302,
    headers,
  });
};
