/**
 * Admin Properties API
 * PATCH - Update property (feature toggle, etc.)
 * DELETE - Delete property and all associated data
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { db, properties, propertyPhotos, propertyFeatures, contributions } from '../../../lib/db';
import { eq } from 'drizzle-orm';
import { validateSession, getSessionFromCookies } from '../../../lib/auth';

// Helper to check admin auth
async function checkAdmin(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  const sessionToken = getSessionFromCookies(cookieHeader);
  if (!sessionToken) return null;

  const session = await validateSession(sessionToken);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'moderator')) {
    return null;
  }
  return session.user;
}

export const PATCH: APIRoute = async ({ request }) => {
  const user = await checkAdmin(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { id, featured } = await request.json();

    if (!id) {
      return new Response(JSON.stringify({ error: 'Property ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update property
    await db
      .update(properties)
      .set({ featured: featured ?? false })
      .where(eq(properties.id, id));

    console.log(`[Admin] Property ${id} featured=${featured} by ${user.email}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Admin properties PATCH error:', err);
    return new Response(JSON.stringify({ error: 'Failed to update property' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  const user = await checkAdmin(request);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { id } = await request.json();

    if (!id) {
      return new Response(JSON.stringify({ error: 'Property ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Delete in order (foreign key constraints)
    // 1. Property features
    await db.delete(propertyFeatures).where(eq(propertyFeatures.propertyId, id));

    // 2. Photos
    await db.delete(propertyPhotos).where(eq(propertyPhotos.propertyId, id));

    // 3. Contributions (includes ratings)
    await db.delete(contributions).where(eq(contributions.propertyId, id));

    // 4. Property itself
    await db.delete(properties).where(eq(properties.id, id));

    console.log(`[Admin] Property ${id} deleted by ${user.email}`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Admin properties DELETE error:', err);
    return new Response(JSON.stringify({ error: 'Failed to delete property' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
