/**
 * Property Claim API - POST /api/claims/submit
 *
 * Allows users to claim ownership of a property.
 * - Auto-approved if property has no current owner
 * - Goes to dispute queue if owner already exists
 * - Max 3 claims per user
 * - 24hr cooldown between claims
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { db, properties, propertyClaims, users } from '../../../lib/db';
import { eq, and, gte, count } from 'drizzle-orm';
import { validateSession, getSessionFromCookies } from '../../../lib/auth';

const MAX_CLAIMS_PER_USER = 3;
const COOLDOWN_HOURS = 24;

export const POST: APIRoute = async ({ request }) => {
  try {
    // Check authentication
    const cookieHeader = request.headers.get('cookie');
    const sessionToken = getSessionFromCookies(cookieHeader);
    const session = sessionToken ? await validateSession(sessionToken) : null;

    if (!session?.user) {
      return new Response(
        JSON.stringify({ error: 'You must be logged in to claim a property' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const user = session.user;
    const body = await request.json();
    const { propertyId } = body;

    if (!propertyId) {
      return new Response(
        JSON.stringify({ error: 'Property ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if property exists
    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);

    if (!property) {
      return new Response(
        JSON.stringify({ error: 'Property not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already owns this property
    if (property.ownerId === user.id) {
      return new Response(
        JSON.stringify({ error: 'You already own this property' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already has a pending claim on this property
    const [existingClaim] = await db
      .select()
      .from(propertyClaims)
      .where(
        and(
          eq(propertyClaims.propertyId, propertyId),
          eq(propertyClaims.userId, user.id),
          eq(propertyClaims.status, 'pending')
        )
      )
      .limit(1);

    if (existingClaim) {
      return new Response(
        JSON.stringify({ error: 'You already have a pending claim on this property' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check total approved claims for this user (max 3)
    const [claimCount] = await db
      .select({ count: count() })
      .from(propertyClaims)
      .where(
        and(
          eq(propertyClaims.userId, user.id),
          eq(propertyClaims.status, 'approved')
        )
      );

    // Also count properties they own directly
    const [ownedCount] = await db
      .select({ count: count() })
      .from(properties)
      .where(eq(properties.ownerId, user.id));

    const totalOwned = (claimCount?.count || 0) + (ownedCount?.count || 0);

    if (totalOwned >= MAX_CLAIMS_PER_USER) {
      return new Response(
        JSON.stringify({ error: `You can only claim up to ${MAX_CLAIMS_PER_USER} properties` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check 24hr cooldown from last claim
    const cooldownTime = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000);
    const [recentClaim] = await db
      .select()
      .from(propertyClaims)
      .where(
        and(
          eq(propertyClaims.userId, user.id),
          gte(propertyClaims.createdAt, cooldownTime)
        )
      )
      .limit(1);

    if (recentClaim) {
      const waitTime = Math.ceil(
        (new Date(recentClaim.createdAt!).getTime() + COOLDOWN_HOURS * 60 * 60 * 1000 - Date.now()) / (60 * 60 * 1000)
      );
      return new Response(
        JSON.stringify({
          error: `Please wait ${waitTime} hour${waitTime !== 1 ? 's' : ''} before claiming another property`
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Determine if this is a dispute (property already has owner)
    const isDispute = !!property.ownerId;
    const claimStatus = isDispute ? 'disputed' : 'approved';

    // Create the claim
    const [claim] = await db.insert(propertyClaims).values({
      propertyId,
      userId: user.id,
      status: claimStatus,
      resolvedAt: isDispute ? null : new Date(),
    }).returning({ id: propertyClaims.id });

    // If auto-approved (no existing owner), update the property
    if (!isDispute) {
      await db
        .update(properties)
        .set({
          ownerId: user.id,
          updatedAt: new Date(),
        })
        .where(eq(properties.id, propertyId));

      return new Response(
        JSON.stringify({
          success: true,
          status: 'approved',
          message: 'You are now the owner of this property!',
          claimId: claim.id,
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // It's a dispute - needs admin review
    return new Response(
      JSON.stringify({
        success: true,
        status: 'disputed',
        message: 'This property already has an owner. Your claim has been submitted for review.',
        claimId: claim.id,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Claim error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to submit claim. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
