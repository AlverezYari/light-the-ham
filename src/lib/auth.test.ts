import { describe, expect, it } from 'vitest';
import { createLogoutCookie, createSessionCookie, SESSION_COOKIE_NAME } from './auth';

/**
 * These tests pin the cookie attributes we ship.
 * Auth cookies are the most security-critical surface in the app — any change
 * here should be deliberate, and the tests are the place to enforce that.
 */
describe('createSessionCookie', () => {
  it('includes Secure when secure=true (production)', () => {
    const cookie = createSessionCookie('abc', true);
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=abc`);
    expect(cookie).toContain('Path=/');
    expect(cookie).toMatch(/Max-Age=\d+/);
  });

  it('omits Secure when secure=false (dev / http)', () => {
    const cookie = createSessionCookie('abc', false);
    expect(cookie).not.toContain('Secure');
    // Other flags must still be present even in dev.
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });
});

describe('createLogoutCookie', () => {
  it('matches the session cookie shape with Max-Age=0 (browser deletes immediately)', () => {
    const cookie = createLogoutCookie(true);
    expect(cookie).toContain(`${SESSION_COOKIE_NAME}=;`);
    expect(cookie).toContain('Max-Age=0');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Secure');
  });

  it('omits Secure when secure=false', () => {
    expect(createLogoutCookie(false)).not.toContain('Secure');
  });
});
