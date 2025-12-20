/**
 * Property Submission API - POST /api/submit
 *
 * Creates a new property submission with:
 * - Address geocoding
 * - Photo association
 * - Feature tag linking
 * - Contribution record
 *
 * Properties start as 'pending' until approved by admin.
 */

// This must be server-rendered (not static)
export const prerender = false;

import type { APIRoute } from 'astro';
import { db, properties, contributions, propertyPhotos, propertyFeatures, seasons } from '../../lib/db';
import { geocodeAddress, isGeocodeError } from '../../lib/geocode';
import { eq } from 'drizzle-orm';

interface SubmitRequest {
  address: string;
  unit?: string;  // Apt/Suite/Unit number
  city: string;
  zip: string;
  neighborhood?: string;
  displayName?: string;
  description?: string;
  bestTimes?: string;
  contributorType: 'owner' | 'neighbor' | 'visitor';
  features: string[];  // Array of feature tag IDs
  photoUrls: string[];
  ownerId?: string;    // User ID if submitter claims ownership
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    // Parse request body
    const body = await request.json() as SubmitRequest;

    // Validate required fields
    if (!body.address || !body.city || !body.zip) {
      return new Response(
        JSON.stringify({ error: 'Address, city, and ZIP are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!body.contributorType) {
      return new Response(
        JSON.stringify({ error: 'Contributor type is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!body.photoUrls || body.photoUrls.length === 0) {
      return new Response(
        JSON.stringify({ error: 'At least one photo is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate ZIP format
    if (!/^\d{5}$/.test(body.zip)) {
      return new Response(
        JSON.stringify({ error: 'Invalid ZIP code format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Geocode the address
    console.log(`📍 Geocoding: ${body.address}, ${body.city}, AL ${body.zip}`);
    const geocodeResult = await geocodeAddress(body.address, body.city, 'AL', body.zip);

    if (isGeocodeError(geocodeResult)) {
      return new Response(
        JSON.stringify({ error: geocodeResult.error }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`   ✓ Found: ${geocodeResult.lat}, ${geocodeResult.lng}`);

    // Build full address with unit for display/storage
    const fullAddress = body.unit
      ? `${body.address}, ${body.unit}`
      : body.address;

    // Get current active season
    const currentSeason = await db
      .select()
      .from(seasons)
      .where(eq(seasons.status, 'active'))
      .limit(1);

    if (currentSeason.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No active season found' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const seasonId = currentSeason[0].id;

    // Create the property
    const [property] = await db.insert(properties).values({
      seasonId,
      address: fullAddress,
      city: body.city,
      state: 'AL',
      zip: body.zip,
      neighborhood: body.neighborhood || null,
      lat: geocodeResult.lat,
      lng: geocodeResult.lng,
      displayName: body.displayName || null,
      description: body.description || null,
      bestTimes: body.bestTimes || null,
      status: 'pending',  // Requires moderation
      photoCount: body.photoUrls.length,
      contributionCount: 1,
      // Track owner if they claim ownership and are logged in
      ownerId: body.contributorType === 'owner' && body.ownerId ? body.ownerId : null,
    }).returning({ id: properties.id });

    console.log(`🏠 Created property: ${property.id}`);

    // Create contribution record
    // Hash the IP for anonymous tracking (don't store raw IP)
    const anonymousId = clientAddress
      ? Buffer.from(clientAddress).toString('base64').slice(0, 16)
      : null;

    const [contribution] = await db.insert(contributions).values({
      propertyId: property.id,
      contributorType: body.contributorType,
      anonymousId,
      userId: body.ownerId || null,  // Link to user if they're logged in
      status: 'pending',
    }).returning({ id: contributions.id });

    // Add photos
    for (let i = 0; i < body.photoUrls.length; i++) {
      await db.insert(propertyPhotos).values({
        propertyId: property.id,
        contributionId: contribution.id,
        url: body.photoUrls[i],
        isPrimary: i === 0,  // First photo is primary
        status: 'pending',
      });
    }

    console.log(`   📸 Added ${body.photoUrls.length} photos`);

    // Link feature tags
    if (body.features && body.features.length > 0) {
      for (const featureId of body.features) {
        await db.insert(propertyFeatures).values({
          propertyId: property.id,
          featureId,
          contributionId: contribution.id,
          confirmedCount: 1,
        }).onConflictDoNothing();
      }
      console.log(`   ✨ Added ${body.features.length} features`);
    }

    console.log(`✅ Submission complete: ${property.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        propertyId: property.id,
        message: 'Property submitted successfully! It will be reviewed shortly.',
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (err) {
    console.error('Submission error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to submit property. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
