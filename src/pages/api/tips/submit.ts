/**
 * Submit Tip API - POST /api/tips/submit
 *
 * Submit or update a tip for a property. Requires authentication.
 * Each user can have 1 tip per property (can edit/overwrite).
 *
 * Limits:
 * - Max 280 characters
 * - No URLs allowed
 * - 1 tip per user per property (overwrites previous)
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { db, properties, contributions } from '../../../lib/db';
import { eq, and } from 'drizzle-orm';
import { validateSession, getSessionFromCookies } from '../../../lib/auth';

// Limits
const MAX_TIP_LENGTH = 280;

// Simple URL detection regex
const URL_REGEX = /https?:\/\/|www\.|\.com|\.org|\.net|\.io/i;

export const POST: APIRoute = async ({ request }) => {
  try {
    // Check authentication
    const cookieHeader = request.headers.get('cookie');
    const sessionToken = getSessionFromCookies(cookieHeader);
    const session = sessionToken ? await validateSession(sessionToken) : null;

    if (!session) {
      return new Response(
        JSON.stringify({ error: 'You must be logged in to submit tips' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const user = session.user;

    // Parse request body
    const body = await request.json() as { propertyId: string; tip: string };
    const { propertyId, tip } = body;

    if (!propertyId || !tip) {
      return new Response(
        JSON.stringify({ error: 'Property ID and tip are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate tip length
    const trimmedTip = tip.trim();
    if (trimmedTip.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Tip cannot be empty' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (trimmedTip.length > MAX_TIP_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Tip must be ${MAX_TIP_LENGTH} characters or less` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check for URLs
    if (URL_REGEX.test(trimmedTip)) {
      return new Response(
        JSON.stringify({ error: 'Tips cannot contain URLs or links' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify property exists and is approved
    const property = await db
      .select({ id: properties.id })
      .from(properties)
      .where(and(eq(properties.id, propertyId), eq(properties.status, 'approved')))
      .limit(1);

    if (property.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Property not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already has a tip for this property
    const existingTip = await db
      .select({ id: contributions.id })
      .from(contributions)
      .where(
        and(
          eq(contributions.propertyId, propertyId),
          eq(contributions.userId, user.id),
          eq(contributions.tip, contributions.tip) // Has a tip (not null check workaround)
        )
      )
      .limit(1);

    if (existingTip.length > 0) {
      // Update existing tip
      await db
        .update(contributions)
        .set({
          tip: trimmedTip,
          status: 'pending', // Re-submit for moderation
          updatedAt: new Date(),
        })
        .where(eq(contributions.id, existingTip[0].id));

      console.log(`💡 Tip updated for property ${propertyId} by user ${user.id}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Tip updated! It will appear after moderation.',
          updated: true,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create new tip
    await db.insert(contributions).values({
      propertyId,
      userId: user.id,
      contributorType: 'visitor',
      tip: trimmedTip,
      status: 'pending',
    });

    console.log(`💡 New tip submitted for property ${propertyId} by user ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Tip submitted! It will appear after moderation.',
        updated: false,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Tip submission error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to submit tip' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
