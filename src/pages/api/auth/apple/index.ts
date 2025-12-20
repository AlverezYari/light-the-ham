/**
 * Apple OAuth Initiation - GET /api/auth/apple
 *
 * Redirects user to Apple's Sign In screen.
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { apple } from '../../../../lib/auth';
import { generateState } from 'arctic';

export const GET: APIRoute = async ({ cookies, redirect }) => {
  const state = generateState();

  const url = apple.createAuthorizationURL(state, [
    'name',
    'email',
  ]);

  // Store state in cookie for callback validation
  cookies.set('apple_oauth_state', state, {
    path: '/',
    httpOnly: true,
    secure: import.meta.env.PROD,
    maxAge: 60 * 10, // 10 minutes
    sameSite: 'lax',
  });

  return redirect(url.toString());
};
