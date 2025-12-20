/**
 * Rating API - POST /api/rate
 *
 * Submit a rating for a property.
 * Ratings are 0.5 to 5 in 0.5 increments (half-star style).
 *
 * Creates a contribution record and updates the property's
 * aggregate rating (avgRating, ratingCount).
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { db, properties, contributions } from '../../lib/db';
import { eq, sql } from 'drizzle-orm';
import { ratingsSubmitted } from '../../lib/metrics';

interface RateRequest {
  propertyId: string;
  rating: number;  // 0.5 to 5 in 0.5 increments
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const body = await request.json() as RateRequest;

    // Validate property ID
    if (!body.propertyId) {
      return new Response(
        JSON.stringify({ error: 'Property ID is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate rating value (0.5 to 5 in 0.5 increments)
    const rating = body.rating;
    if (
      typeof rating !== 'number' ||
      rating < 0.5 ||
      rating > 5 ||
      (rating * 2) % 1 !== 0  // Must be a multiple of 0.5
    ) {
      return new Response(
        JSON.stringify({ error: 'Rating must be 0.5 to 5 in 0.5 increments' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify property exists and is approved
    const property = await db
      .select({ id: properties.id, status: properties.status })
      .from(properties)
      .where(eq(properties.id, body.propertyId))
      .limit(1);

    if (property.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Property not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (property[0].status !== 'approved') {
      return new Response(
        JSON.stringify({ error: 'Cannot rate this property' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create anonymous ID from IP (simple rate limiting)
    const anonymousId = clientAddress
      ? Buffer.from(clientAddress).toString('base64').slice(0, 16)
      : `anon-${Date.now()}`;

    // Check if this user already rated this property (simple duplicate prevention)
    // In production, you might use sessions or more sophisticated tracking
    const existingRating = await db
      .select({ id: contributions.id })
      .from(contributions)
      .where(
        sql`${contributions.propertyId} = ${body.propertyId}
            AND ${contributions.anonymousId} = ${anonymousId}
            AND ${contributions.rating} IS NOT NULL`
      )
      .limit(1);

    if (existingRating.length > 0) {
      return new Response(
        JSON.stringify({ error: 'You have already rated this property' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create contribution with rating
    await db.insert(contributions).values({
      propertyId: body.propertyId,
      contributorType: 'visitor',
      anonymousId,
      rating: rating,
      status: 'approved',  // Ratings are auto-approved
    });

    // Update property aggregate rating
    // Calculate new average from all approved ratings
    const ratingsResult = await db
      .select({
        avgRating: sql<number>`AVG(${contributions.rating})`,
        count: sql<number>`COUNT(*)`,
      })
      .from(contributions)
      .where(
        sql`${contributions.propertyId} = ${body.propertyId}
            AND ${contributions.rating} IS NOT NULL
            AND ${contributions.status} = 'approved'`
      );

    const newAvg = ratingsResult[0]?.avgRating || 0;
    const newCount = ratingsResult[0]?.count || 0;

    // Update property with new aggregates
    await db
      .update(properties)
      .set({
        avgRating: Math.round(newAvg * 10) / 10,  // Round to 1 decimal
        ratingCount: newCount,
      })
      .where(eq(properties.id, body.propertyId));

    console.log(`⭐ Rating submitted: ${rating} for property ${body.propertyId} (new avg: ${newAvg.toFixed(1)}, count: ${newCount})`);

    // Track metric
    ratingsSubmitted.inc({ rating: rating.toString() });

    return new Response(
      JSON.stringify({
        success: true,
        newAvgRating: Math.round(newAvg * 10) / 10,
        newRatingCount: newCount,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (err) {
    console.error('Rating error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to submit rating' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
