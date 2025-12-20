/**
 * Authentication Configuration
 *
 * Uses Arctic for OAuth with Google, Apple, and Facebook.
 * Sessions stored in SQLite via Drizzle.
 */

import { Google, Apple, Facebook } from 'arctic';
import { db, users, sessions } from './db';
import { eq, and } from 'drizzle-orm';

// ============================================================
// OAUTH PROVIDERS
// ============================================================

// Helper to get env var from either Vite (dev) or Node (prod)
// In dev, Vite loads .env into import.meta.env
// In prod (Docker), we set process.env directly
function getEnv(key: string): string {
  // @ts-ignore - import.meta.env exists at runtime in Vite/Astro
  return import.meta.env?.[key] || process.env[key] || '';
}

const baseUrl = getEnv('SITE_URL') || 'http://localhost:4321';

export const google = new Google(
  getEnv('GOOGLE_CLIENT_ID'),
  getEnv('GOOGLE_CLIENT_SECRET'),
  `${baseUrl}/api/auth/google/callback`
);

export const apple = new Apple(
  getEnv('APPLE_CLIENT_ID'),
  getEnv('APPLE_TEAM_ID'),
  getEnv('APPLE_KEY_ID'),
  getEnv('APPLE_PRIVATE_KEY'),
  `${baseUrl}/api/auth/apple/callback`
);

export const facebook = new Facebook(
  getEnv('FACEBOOK_CLIENT_ID'),
  getEnv('FACEBOOK_CLIENT_SECRET'),
  `${baseUrl}/api/auth/facebook/callback`
);

// ============================================================
// SESSION MANAGEMENT
// ============================================================

const SESSION_DURATION_DAYS = 30;

/**
 * Generate a secure session token
 */
function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a new session for a user
 */
export async function createSession(userId: string): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  await db.insert(sessions).values({
    id: token,
    userId,
    expiresAt,
  });

  return token;
}

/**
 * Validate a session token and return the user
 */
export async function validateSession(token: string) {
  if (!token) return null;

  const result = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, token))
    .limit(1);

  if (result.length === 0) return null;

  const { session, user } = result[0];

  // Check if session expired
  if (session.expiresAt < new Date()) {
    await db.delete(sessions).where(eq(sessions.id, token));
    return null;
  }

  return { session, user };
}

/**
 * Delete a session (logout)
 */
export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, token));
}

/**
 * Delete all sessions for a user
 */
export async function deleteAllUserSessions(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

// ============================================================
// USER MANAGEMENT
// ============================================================

interface OAuthUser {
  provider: 'google' | 'apple' | 'facebook';
  providerId: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

/**
 * Find or create a user from OAuth data
 */
export async function findOrCreateUser(oauthUser: OAuthUser) {
  // Check if user exists with this OAuth provider
  const existing = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.oauthProvider, oauthUser.provider),
        eq(users.oauthProviderId, oauthUser.providerId)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Update last active and return
    await db
      .update(users)
      .set({ lastActive: new Date() })
      .where(eq(users.id, existing[0].id));
    return existing[0];
  }

  // Create new user
  const result = await db
    .insert(users)
    .values({
      email: oauthUser.email,
      displayName: oauthUser.displayName,
      avatarUrl: oauthUser.avatarUrl,
      oauthProvider: oauthUser.provider,
      oauthProviderId: oauthUser.providerId,
      lastActive: new Date(),
    })
    .returning();

  return result[0];
}

// ============================================================
// COOKIE HELPERS
// ============================================================

export const SESSION_COOKIE_NAME = 'lth_session';

export function createSessionCookie(token: string): string {
  const maxAge = SESSION_DURATION_DAYS * 24 * 60 * 60; // seconds
  return `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export function createLogoutCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/**
 * Parse session token from cookie header
 */
export function getSessionFromCookies(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  return cookies[SESSION_COOKIE_NAME] || null;
}
