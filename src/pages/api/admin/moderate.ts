/**
 * Admin Moderation API - POST /api/admin/moderate
 *
 * Approve or reject pending content.
 * Requires admin or moderator role.
 *
 * Body: { entityType: 'photo' | 'tip' | 'property', entityId: string, action: 'approve' | 'reject' }
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { db, contributions, propertyPhotos, properties, moderationLog, users, tours, tourStops, propertyClaims } from '../../../lib/db';
import { eq } from 'drizzle-orm';
import { validateSession, getSessionFromCookies } from '../../../lib/auth';

type EntityType = 'photo' | 'tip' | 'property' | 'tour' | 'claim';
type Action = 'approve' | 'reject' | 'delete' | 'feature' | 'unfeature';

interface ModerateRequest {
  entityType: EntityType;
  entityId: string;
  action: Action;
  reason?: string;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // Check authentication
    const cookieHeader = request.headers.get('cookie');
    const sessionToken = getSessionFromCookies(cookieHeader);
    const session = sessionToken ? await validateSession(sessionToken) : null;

    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check admin/moderator role
    const user = session.user;
    if (user.role !== 'admin' && user.role !== 'moderator') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await request.json() as ModerateRequest;
    const { entityType, entityId, action, reason } = body;

    if (!entityType || !entityId || !action) {
      return new Response(
        JSON.stringify({ error: 'entityType, entityId, and action are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!['photo', 'tip', 'property', 'tour', 'claim'].includes(entityType)) {
      return new Response(
        JSON.stringify({ error: 'Invalid entityType' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!['approve', 'reject', 'delete', 'feature', 'unfeature'].includes(action)) {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let previousStatus: string | null = null;
    let newStatus: string = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : action;

    // Update the entity based on type
    switch (entityType) {
      case 'photo': {
        const existing = await db
          .select({ status: propertyPhotos.status })
          .from(propertyPhotos)
          .where(eq(propertyPhotos.id, entityId))
          .limit(1);

        if (existing.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Photo not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          );
        }

        previousStatus = existing[0].status;
        const photoStatus = action === 'approve' ? 'approved' : 'rejected';

        await db
          .update(propertyPhotos)
          .set({
            status: photoStatus,
            moderatedAt: new Date(),
            moderatedBy: user.id,
          })
          .where(eq(propertyPhotos.id, entityId));
        break;
      }

      case 'tip': {
        const existing = await db
          .select({ status: contributions.status })
          .from(contributions)
          .where(eq(contributions.id, entityId))
          .limit(1);

        if (existing.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Tip not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          );
        }

        previousStatus = existing[0].status;
        const tipStatus = action === 'approve' ? 'approved' : 'rejected';

        await db
          .update(contributions)
          .set({
            status: tipStatus,
            moderatedAt: new Date(),
            moderatedBy: user.id,
          })
          .where(eq(contributions.id, entityId));
        break;
      }

      case 'property': {
        const existing = await db
          .select({ status: properties.status })
          .from(properties)
          .where(eq(properties.id, entityId))
          .limit(1);

        if (existing.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Property not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          );
        }

        previousStatus = existing[0].status;
        const propStatus = action === 'approve' ? 'approved' : 'rejected';

        await db
          .update(properties)
          .set({
            status: propStatus,
            approvedAt: action === 'approve' ? new Date() : null,
            approvedBy: action === 'approve' ? user.id : null,
            updatedAt: new Date(),
          })
          .where(eq(properties.id, entityId));
        break;
      }

      case 'tour': {
        // Tours support delete, feature, and unfeature
        if (!['delete', 'feature', 'unfeature'].includes(action)) {
          return new Response(
            JSON.stringify({ error: 'Tours only support delete, feature, and unfeature actions' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const existing = await db
          .select({ id: tours.id, name: tours.name, isFeatured: tours.isFeatured })
          .from(tours)
          .where(eq(tours.id, entityId))
          .limit(1);

        if (existing.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Tour not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          );
        }

        previousStatus = existing[0].isFeatured ? 'featured' : 'active';

        if (action === 'delete') {
          // Delete tour stops first (cascade should handle this, but being explicit)
          await db.delete(tourStops).where(eq(tourStops.tourId, entityId));
          // Delete the tour
          await db.delete(tours).where(eq(tours.id, entityId));
        } else {
          // Feature or unfeature
          await db
            .update(tours)
            .set({
              isFeatured: action === 'feature',
              updatedAt: new Date(),
            })
            .where(eq(tours.id, entityId));
        }
        break;
      }

      case 'claim': {
        // Claims support approve and reject
        if (!['approve', 'reject'].includes(action)) {
          return new Response(
            JSON.stringify({ error: 'Claims only support approve and reject actions' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const existing = await db
          .select({
            id: propertyClaims.id,
            status: propertyClaims.status,
            propertyId: propertyClaims.propertyId,
            userId: propertyClaims.userId,
          })
          .from(propertyClaims)
          .where(eq(propertyClaims.id, entityId))
          .limit(1);

        if (existing.length === 0) {
          return new Response(
            JSON.stringify({ error: 'Claim not found' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const claim = existing[0];
        previousStatus = claim.status;
        const claimStatus = action === 'approve' ? 'approved' : 'rejected';

        // Update claim status
        await db
          .update(propertyClaims)
          .set({
            status: claimStatus,
            resolvedAt: new Date(),
            resolvedBy: user.id,
          })
          .where(eq(propertyClaims.id, entityId));

        // If approved, update property owner
        if (action === 'approve') {
          await db
            .update(properties)
            .set({
              ownerId: claim.userId,
              updatedAt: new Date(),
            })
            .where(eq(properties.id, claim.propertyId));
        }
        break;
      }
    }

    // Log moderation action
    await db.insert(moderationLog).values({
      moderatorId: user.id,
      entityType,
      entityId,
      action,
      reason: reason || null,
      previousStatus,
      newStatus,
    });

    console.log(`🔨 ${user.email} ${action}d ${entityType} ${entityId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${entityType} ${action}d successfully`,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Moderation error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to moderate content' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
