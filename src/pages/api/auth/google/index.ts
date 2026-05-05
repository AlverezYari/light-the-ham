/**
 * Google OAuth Initiation - GET /api/auth/google
 *
 * Redirects user to Google's OAuth consent screen.
 */

export const prerender = false;

import { generateCodeVerifier, generateState } from 'arctic';
import type { APIRoute } from 'astro';
import { google } from '../../../../lib/auth';

export const GET: APIRoute = async ({ cookies, redirect }) => {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  const url = google.createAuthorizationURL(state, codeVerifier, ['openid', 'profile', 'email']);

  // Store state and verifier in cookies for callback validation
  cookies.set('google_oauth_state', state, {
    path: '/',
    httpOnly: true,
    secure: import.meta.env.PROD,
    maxAge: 60 * 10, // 10 minutes
    sameSite: 'lax',
  });

  cookies.set('google_code_verifier', codeVerifier, {
    path: '/',
    httpOnly: true,
    secure: import.meta.env.PROD,
    maxAge: 60 * 10,
    sameSite: 'lax',
  });

  return redirect(url.toString());
};
