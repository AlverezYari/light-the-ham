/**
 * Facebook OAuth Callback - GET /api/auth/facebook/callback
 *
 * Handles the redirect from Facebook after user consent.
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { facebook, findOrCreateUser, createSession, createSessionCookie } from '../../../../lib/auth';

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const storedState = cookies.get('facebook_oauth_state')?.value;

  // Clean up OAuth cookie
  cookies.delete('facebook_oauth_state', { path: '/' });

  // Validate state
  if (!code || !state || !storedState || state !== storedState) {
    console.error('Facebook OAuth: Invalid state or missing params');
    return redirect('/login?error=invalid_state');
  }

  try {
    // Exchange code for tokens
    const tokens = await facebook.validateAuthorizationCode(code);

    // Get user info from Facebook Graph API
    const response = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${tokens.accessToken()}`
    );

    if (!response.ok) {
      throw new Error('Failed to get user info from Facebook');
    }

    const fbUser = await response.json() as {
      id: string;
      email?: string;
      name?: string;
      picture?: { data?: { url?: string } };
    };

    // Find or create user in our database
    const user = await findOrCreateUser({
      provider: 'facebook',
      providerId: fbUser.id,
      email: fbUser.email || null,
      displayName: fbUser.name || null,
      avatarUrl: fbUser.picture?.data?.url || null,
    });

    // Create session
    const sessionToken = await createSession(user.id);

    // Set session cookie
    const headers = new Headers();
    headers.append('Set-Cookie', createSessionCookie(sessionToken));
    headers.append('Location', '/');

    return new Response(null, {
      status: 302,
      headers,
    });

  } catch (error) {
    console.error('Facebook OAuth error:', error);
    return redirect('/login?error=oauth_failed');
  }
};
