/**
 * Photo Upload API - POST /api/photos/upload
 *
 * Uploads a photo for a property. Requires authentication.
 *
 * Limits:
 * - Max file size: 5MB
 * - Max per user per property: 3
 * - Max per property per season: 20
 * - File types: jpg, jpeg, png, webp
 */

export const prerender = false;

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { APIRoute } from 'astro';
import { and, eq, sql } from 'drizzle-orm';
import { getSessionFromCookies, validateSession } from '../../../lib/auth';
import { contributions, db, properties, propertyPhotos } from '../../../lib/db';
import { validateImage } from '../../../lib/security/image-validate';
import { isValidUuid } from '../../../lib/security/uuid';

// Limits
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_PER_USER_PER_PROPERTY = 3;
const MAX_PER_PROPERTY = 20;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const POST: APIRoute = async ({ request }) => {
  try {
    // Check authentication
    const cookieHeader = request.headers.get('cookie');
    const sessionToken = getSessionFromCookies(cookieHeader);
    const session = sessionToken ? await validateSession(sessionToken) : null;

    if (!session) {
      return new Response(JSON.stringify({ error: 'You must be logged in to upload photos' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const user = session.user;
    const isAdmin = user.role === 'admin' || user.role === 'moderator';

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('photo') as File | null;
    const propertyId = formData.get('propertyId') as string | null;

    if (!file || !propertyId) {
      return new Response(JSON.stringify({ error: 'Photo and propertyId are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!isValidUuid(propertyId)) {
      return new Response(JSON.stringify({ error: 'Invalid property ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // File-size check first (cheap, rejects abuse before reading the buffer).
    if (file.size > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({ error: 'File size must be under 5MB' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Magic-byte validation. Browser-supplied file.type is spoofable;
    // we sniff the actual signature and trust that.
    const buffer = Buffer.from(await file.arrayBuffer());
    const validated = await validateImage(buffer, ALLOWED_TYPES);
    if (!validated.ok) {
      return new Response(JSON.stringify({ error: validated.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify property exists and is approved
    const property = await db
      .select({ id: properties.id, seasonId: properties.seasonId })
      .from(properties)
      .where(and(eq(properties.id, propertyId), eq(properties.status, 'approved')))
      .limit(1);

    if (property.length === 0) {
      return new Response(JSON.stringify({ error: 'Property not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check property photo limit (20 per property) - skip for admins
    if (!isAdmin) {
      const propertyPhotoCount = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(propertyPhotos)
        .where(eq(propertyPhotos.propertyId, propertyId));

      if ((propertyPhotoCount[0]?.count || 0) >= MAX_PER_PROPERTY) {
        return new Response(
          JSON.stringify({ error: 'This property has reached the maximum number of photos' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }

      // Check user's photo limit for this property (3 per user)
      const userPhotoCount = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(propertyPhotos)
        .innerJoin(contributions, eq(propertyPhotos.contributionId, contributions.id))
        .where(and(eq(propertyPhotos.propertyId, propertyId), eq(contributions.userId, user.id)));

      if ((userPhotoCount[0]?.count || 0) >= MAX_PER_USER_PER_PROPERTY) {
        return new Response(
          JSON.stringify({
            error: `You can only upload ${MAX_PER_USER_PER_PROPERTY} photos per property`,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }
    }

    // Build filename from the *validated* extension, not the user-supplied name.
    const filename = `${propertyId}-${user.id.slice(0, 8)}-${Date.now()}.${validated.ext}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    const filepath = path.join(uploadDir, filename);

    // Ensure uploads directory exists
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    await writeFile(filepath, buffer);

    // Create contribution record
    const contributionResult = await db
      .insert(contributions)
      .values({
        propertyId,
        userId: user.id,
        contributorType: 'visitor',
        status: 'pending',
      })
      .returning({ id: contributions.id });

    // Create photo record (pending moderation)
    const photoResult = await db
      .insert(propertyPhotos)
      .values({
        propertyId,
        contributionId: contributionResult[0].id,
        url: `/uploads/${filename}`,
        fileSize: file.size,
        status: 'pending',
      })
      .returning({ id: propertyPhotos.id });

    console.log(`📸 Photo uploaded: ${filename} for property ${propertyId} by user ${user.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Photo uploaded! It will appear after moderation.',
        photoId: photoResult[0].id,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('Photo upload error:', err);
    return new Response(JSON.stringify({ error: 'Failed to upload photo' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
