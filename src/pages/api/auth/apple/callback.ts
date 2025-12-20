/**
 * Apple OAuth Callback - POST /api/auth/apple/callback
 *
 * Apple uses POST for the callback and only sends user info on first sign-in.
 * The ID token contains the user's email (if they allowed).
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { apple, findOrCreateUser, createSession, createSessionCookie } from '../../../../lib/auth';
import { decodeIdToken } from 'arctic';

// Apple sends POST request
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const code = formData.get('code')?.toString();
  const state = formData.get('state')?.toString();

  // Apple only sends user info on first authorization
  const userJson = formData.get('user')?.toString();
  let appleUserInfo: { name?: { firstName?: string; lastName?: string }; email?: string } | null = null;
  if (userJson) {
    try {
      appleUserInfo = JSON.parse(userJson);
    } catch (e) {
      // Ignore parse errors
    }
  }

  const storedState = cookies.get('apple_oauth_state')?.value;

  // Clean up OAuth cookie
  cookies.delete('apple_oauth_state', { path: '/' });

  // Validate state
  if (!code || !state || !storedState || state !== storedState) {
    console.error('Apple OAuth: Invalid state or missing params');
    return redirect('/login?error=invalid_state');
  }

  try {
    // Exchange code for tokens
    const tokens = await apple.validateAuthorizationCode(code);

    // Decode the ID token to get user info
    const idToken = tokens.idToken();
    const claims = decodeIdToken(idToken) as {
      sub: string;  // User ID
      email?: string;
    };

    // Build display name from Apple user info (only available on first sign-in)
    let displayName: string | null = null;
    if (appleUserInfo?.name) {
      const { firstName, lastName } = appleUserInfo.name;
      displayName = [firstName, lastName].filter(Boolean).join(' ') || null;
    }

    // Use email from claims or user info
    const email = claims.email || appleUserInfo?.email || null;

    // Find or create user in our database
    const user = await findOrCreateUser({
      provider: 'apple',
      providerId: claims.sub,
      email,
      displayName,
      avatarUrl: null, // Apple doesn't provide profile pictures
    });

    // Create session
    const sessionToken = await createSession(user.id);

    // Set session cookie and redirect
    const headers = new Headers();
    headers.append('Set-Cookie', createSessionCookie(sessionToken));
    headers.append('Location', '/');

    return new Response(null, {
      status: 302,
      headers,
    });

  } catch (error) {
    console.error('Apple OAuth error:', error);
    return redirect('/login?error=oauth_failed');
  }
};

// Also handle GET in case of error redirects
export const GET: APIRoute = async ({ url, redirect }) => {
  const error = url.searchParams.get('error');
  if (error) {
    return redirect(`/login?error=${error}`);
  }
  return redirect('/login?error=invalid_request');
};
