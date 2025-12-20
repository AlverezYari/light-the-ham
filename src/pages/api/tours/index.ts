/**
 * Tours API
 *
 * POST /api/tours - Create a new tour
 * GET /api/tours - List public/featured tours
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { db, tours, tourStops, properties, propertyPhotos } from '../../../lib/db';
import { eq, and, desc } from 'drizzle-orm';
import { toursCreated } from '../../../lib/metrics';

// Generate a URL-friendly slug
function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40);
  const random = Math.random().toString(36).slice(2, 8);
  return `${base}-${random}`;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.propertyIds || body.propertyIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Tour name and at least one property are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (body.propertyIds.length > 20) {
      return new Response(
        JSON.stringify({ error: 'Tours can have a maximum of 20 stops' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique slug
    const slug = generateSlug(body.name);

    // Create the tour
    const [tour] = await db.insert(tours).values({
      slug,
      name: body.name,
      description: body.description || null,
      creatorName: body.creatorName || 'Anonymous',
      isPublic: body.isPublic !== false,
    }).returning({ id: tours.id, slug: tours.slug });

    // Add stops in order
    for (let i = 0; i < body.propertyIds.length; i++) {
      await db.insert(tourStops).values({
        tourId: tour.id,
        propertyId: body.propertyIds[i],
        position: i,
        note: body.notes?.[i] || null,
      });
    }

    console.log(`🗺️ Created tour: ${tour.slug} with ${body.propertyIds.length} stops`);

    // Track metric
    toursCreated.inc();

    return new Response(
      JSON.stringify({
        success: true,
        slug: tour.slug,
        url: `/tours/${tour.slug}`,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Tour creation error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to create tour' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const GET: APIRoute = async ({ url }) => {
  try {
    const featured = url.searchParams.get('featured') === 'true';

    // Get public tours, optionally filtered to featured only
    const toursList = await db
      .select({
        id: tours.id,
        slug: tours.slug,
        name: tours.name,
        description: tours.description,
        creatorName: tours.creatorName,
        viewCount: tours.viewCount,
        isFeatured: tours.isFeatured,
        createdAt: tours.createdAt,
      })
      .from(tours)
      .where(
        featured
          ? and(eq(tours.isPublic, true), eq(tours.isFeatured, true))
          : eq(tours.isPublic, true)
      )
      .orderBy(desc(tours.viewCount))
      .limit(20);

    // Get stop counts for each tour
    const toursWithCounts = await Promise.all(
      toursList.map(async (tour) => {
        const stops = await db
          .select({ id: tourStops.id })
          .from(tourStops)
          .where(eq(tourStops.tourId, tour.id));
        return {
          ...tour,
          stopCount: stops.length,
        };
      })
    );

    return new Response(
      JSON.stringify({ tours: toursWithCounts }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Tours list error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch tours' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
