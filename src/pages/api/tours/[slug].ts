/**
 * Single Tour API
 *
 * GET /api/tours/[slug] - Get tour details with stops
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { db, tours, tourStops, properties, propertyPhotos } from '../../../lib/db';
import { eq, asc } from 'drizzle-orm';

export const GET: APIRoute = async ({ params }) => {
  try {
    const { slug } = params;

    if (!slug) {
      return new Response(
        JSON.stringify({ error: 'Tour slug is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get the tour
    const [tour] = await db
      .select()
      .from(tours)
      .where(eq(tours.slug, slug))
      .limit(1);

    if (!tour) {
      return new Response(
        JSON.stringify({ error: 'Tour not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Increment view count
    await db
      .update(tours)
      .set({ viewCount: (tour.viewCount || 0) + 1 })
      .where(eq(tours.id, tour.id));

    // Get stops with property details
    const stops = await db
      .select({
        position: tourStops.position,
        note: tourStops.note,
        propertyId: properties.id,
        address: properties.address,
        city: properties.city,
        neighborhood: properties.neighborhood,
        displayName: properties.displayName,
        lat: properties.lat,
        lng: properties.lng,
        avgRating: properties.avgRating,
        ratingCount: properties.ratingCount,
        bestTimes: properties.bestTimes,
      })
      .from(tourStops)
      .innerJoin(properties, eq(tourStops.propertyId, properties.id))
      .where(eq(tourStops.tourId, tour.id))
      .orderBy(asc(tourStops.position));

    // Get primary photo for each stop
    const stopsWithPhotos = await Promise.all(
      stops.map(async (stop) => {
        const [photo] = await db
          .select({ url: propertyPhotos.url })
          .from(propertyPhotos)
          .where(eq(propertyPhotos.propertyId, stop.propertyId))
          .limit(1);

        return {
          ...stop,
          primaryPhoto: photo?.url || null,
          title: stop.displayName || stop.address,
        };
      })
    );

    // Build Google Maps URL for the tour
    const waypoints = stopsWithPhotos.map(s => `${s.lat},${s.lng}`);
    const googleMapsUrl = waypoints.length > 0
      ? `https://www.google.com/maps/dir/${waypoints.join('/')}`
      : null;

    // Build Apple Maps URL
    const appleMapsUrl = waypoints.length > 0
      ? `https://maps.apple.com/?daddr=${waypoints.join('&daddr=')}`
      : null;

    return new Response(
      JSON.stringify({
        tour: {
          id: tour.id,
          slug: tour.slug,
          name: tour.name,
          description: tour.description,
          creatorName: tour.creatorName,
          viewCount: (tour.viewCount || 0) + 1,
          isFeatured: tour.isFeatured,
          createdAt: tour.createdAt,
        },
        stops: stopsWithPhotos,
        navigation: {
          googleMapsUrl,
          appleMapsUrl,
          totalStops: stopsWithPhotos.length,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('Tour fetch error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch tour' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
