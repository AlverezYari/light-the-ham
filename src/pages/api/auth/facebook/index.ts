/**
 * Facebook OAuth Initiation - GET /api/auth/facebook
 *
 * Redirects user to Facebook's OAuth consent screen.
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { facebook } from '../../../../lib/auth';
import { generateState } from 'arctic';

export const GET: APIRoute = async ({ cookies, redirect }) => {
  const state = generateState();

  const url = facebook.createAuthorizationURL(state, [
    'email',
    'public_profile',
  ]);

  // Store state in cookie for callback validation
  cookies.set('facebook_oauth_state', state, {
    path: '/',
    httpOnly: true,
    secure: import.meta.env.PROD,
    maxAge: 60 * 10, // 10 minutes
    sameSite: 'lax',
  });

  return redirect(url.toString());
};
