/**
 * Properties API - GET /api/properties
 *
 * Returns approved properties for the current season.
 * Used by the map to display markers.
 *
 * Query params:
 * - city: Filter by city
 * - featured: Only featured properties
 * - features: Comma-separated feature slugs (e.g., "music-sync,walk-through")
 * - q: Search query (searches displayName, address, neighborhood)
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { db, properties, seasons, propertyPhotos, propertyFeatures, featureTags } from '../../lib/db';
import { eq, and, desc, inArray } from 'drizzle-orm';

export const GET: APIRoute = async ({ url }) => {
  try {
    // Get query params
    const city = url.searchParams.get('city');
    const featured = url.searchParams.get('featured') === 'true';
    const featuresParam = url.searchParams.get('features');
    const featureSlugs = featuresParam ? featuresParam.split(',').filter(Boolean) : [];
    const searchQuery = url.searchParams.get('q')?.toLowerCase().trim() || '';

    // Get current active season
    const currentSeason = await db
      .select()
      .from(seasons)
      .where(eq(seasons.status, 'active'))
      .limit(1);

    if (currentSeason.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No active season' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const seasonId = currentSeason[0].id;

    // Build query conditions
    let conditions = and(
      eq(properties.seasonId, seasonId),
      eq(properties.status, 'approved')
    );

    if (city) {
      conditions = and(conditions, eq(properties.city, city));
    }

    if (featured) {
      conditions = and(conditions, eq(properties.featured, true));
    }

    // Fetch properties
    const props = await db
      .select({
        id: properties.id,
        lat: properties.lat,
        lng: properties.lng,
        address: properties.address,
        city: properties.city,
        neighborhood: properties.neighborhood,
        displayName: properties.displayName,
        description: properties.description,
        bestTimes: properties.bestTimes,
        avgRating: properties.avgRating,
        ratingCount: properties.ratingCount,
        photoCount: properties.photoCount,
        featured: properties.featured,
      })
      .from(properties)
      .where(conditions)
      .orderBy(desc(properties.avgRating));

    // Fetch photo and features for each property
    const propsWithData = await Promise.all(
      props.map(async (prop) => {
        // Try primary photo first
        let photos = await db
          .select({ url: propertyPhotos.url })
          .from(propertyPhotos)
          .where(
            and(
              eq(propertyPhotos.propertyId, prop.id),
              eq(propertyPhotos.status, 'approved'),
              eq(propertyPhotos.isPrimary, true)
            )
          )
          .limit(1);

        // Fall back to any approved photo
        if (photos.length === 0) {
          photos = await db
            .select({ url: propertyPhotos.url })
            .from(propertyPhotos)
            .where(
              and(
                eq(propertyPhotos.propertyId, prop.id),
                eq(propertyPhotos.status, 'approved')
              )
            )
            .limit(1);
        }

        // Get features for this property
        const features = await db
          .select({
            slug: featureTags.slug,
            name: featureTags.name,
            icon: featureTags.icon,
          })
          .from(propertyFeatures)
          .innerJoin(featureTags, eq(propertyFeatures.featureId, featureTags.id))
          .where(eq(propertyFeatures.propertyId, prop.id));

        // Build display title: displayName > "Neighborhood Lights" > address
        const title = prop.displayName
          || (prop.neighborhood ? `${prop.neighborhood} Lights` : null)
          || prop.address;

        return {
          ...prop,
          title,
          primaryPhoto: photos[0]?.url || null,
          features: features.map(f => ({ slug: f.slug, name: f.name, icon: f.icon })),
        };
      })
    );

    // Filter by features if requested
    let filteredProps = propsWithData;
    if (featureSlugs.length > 0) {
      filteredProps = propsWithData.filter(prop =>
        featureSlugs.every(slug => prop.features.some(f => f.slug === slug))
      );
    }

    // Filter by search query if provided
    if (searchQuery) {
      filteredProps = filteredProps.filter(prop => {
        const searchIn = [
          prop.displayName,
          prop.address,
          prop.neighborhood,
          prop.city,
          prop.title,
        ].filter(Boolean).join(' ').toLowerCase();
        return searchIn.includes(searchQuery);
      });
    }

    return new Response(
      JSON.stringify({
        count: filteredProps.length,
        season: currentSeason[0].year,
        properties: filteredProps,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',  // Always fetch fresh data
        }
      }
    );

  } catch (err) {
    console.error('Properties API error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch properties' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
