/**
 * Google OAuth Callback - GET /api/auth/google/callback
 *
 * Handles the redirect from Google after user consent.
 * Creates or updates user, creates session, redirects to app.
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { google, findOrCreateUser, createSession, createSessionCookie } from '../../../../lib/auth';
import { userLogins } from '../../../../lib/metrics';

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const storedState = cookies.get('google_oauth_state')?.value;
  const storedVerifier = cookies.get('google_code_verifier')?.value;

  // Clean up OAuth cookies
  cookies.delete('google_oauth_state', { path: '/' });
  cookies.delete('google_code_verifier', { path: '/' });

  // Validate state
  if (!code || !state || !storedState || !storedVerifier || state !== storedState) {
    console.error('Google OAuth: Invalid state or missing params');
    return redirect('/login?error=invalid_state');
  }

  try {
    // Exchange code for tokens
    const tokens = await google.validateAuthorizationCode(code, storedVerifier);

    // Get user info from Google
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.accessToken()}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to get user info from Google');
    }

    const googleUser = await response.json() as {
      id: string;
      email?: string;
      name?: string;
      picture?: string;
    };

    // Find or create user in our database
    const user = await findOrCreateUser({
      provider: 'google',
      providerId: googleUser.id,
      email: googleUser.email || null,
      displayName: googleUser.name || null,
      avatarUrl: googleUser.picture || null,
    });

    // Create session
    const sessionToken = await createSession(user.id);

    // Track login metric
    userLogins.inc({ provider: 'google' });

    // Set session cookie
    const headers = new Headers();
    headers.append('Set-Cookie', createSessionCookie(sessionToken));
    headers.append('Location', '/');

    return new Response(null, {
      status: 302,
      headers,
    });

  } catch (error) {
    console.error('Google OAuth error:', error);
    return redirect('/login?error=oauth_failed');
  }
};
