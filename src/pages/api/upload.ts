/**
 * Anonymous Photo Upload API - POST /api/upload
 *
 * Used during the property submission flow (`src/pages/submit.astro`) to
 * upload a photo *before* the property exists in the DB. Anonymous because
 * submission itself is anonymous; the resulting URL gets attached to the
 * property record on submit.
 *
 * Distinct from `/api/photos/upload`, which is the authenticated post-creation
 * upload that creates a contribution + photo record with moderation status.
 *
 * Defense in depth (added Phase 1):
 * - Rate-limited at the middleware layer (token bucket per IP).
 * - CSRF-checked at the middleware layer (Origin must match SITE_URL).
 * - Magic-byte validated here (browser-supplied MIME is ignored).
 */

export const prerender = false;

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { APIRoute } from 'astro';
import { validateImage } from '../../lib/security/image-validate';

const UPLOAD_DIR = 'public/uploads';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export const POST: APIRoute = async ({ request }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({
          error: `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const validated = await validateImage(buffer, ALLOWED_TYPES);
    if (!validated.ok) {
      return new Response(JSON.stringify({ error: validated.error }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const filename = `${timestamp}-${random}.${validated.ext}`;

    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    const filepath = path.join(UPLOAD_DIR, filename);
    await writeFile(filepath, buffer);

    const url = `/uploads/${filename}`;
    console.log(`📸 Uploaded: ${filename} (${(file.size / 1024).toFixed(1)}KB)`);

    return new Response(JSON.stringify({ url, filename, size: file.size, type: validated.mime }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Upload error:', err);
    return new Response(JSON.stringify({ error: 'Failed to upload file' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
