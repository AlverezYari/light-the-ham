/**
 * Photo Upload API - POST /api/upload
 *
 * Handles image uploads for property submissions.
 * Saves files to public/uploads/ directory.
 *
 * In production, you'd want to:
 * - Use cloud storage (S3, R2, etc.)
 * - Add image optimization
 * - Virus/content scanning
 */

// This must be server-rendered (not static)
export const prerender = false;

import type { APIRoute } from 'astro';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Config
const UPLOAD_DIR = 'public/uploads';
const MAX_FILE_SIZE = 10 * 1024 * 1024;  // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export const POST: APIRoute = async ({ request }) => {
  try {
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return new Response(
        JSON.stringify({
          error: `Invalid file type: ${file.type}. Allowed: JPEG, PNG, WebP, GIF`
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({
          error: `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB`
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'jpg';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const filename = `${timestamp}-${random}.${ext}`;

    // Ensure upload directory exists
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    // Save file
    const filepath = path.join(UPLOAD_DIR, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    // Return the public URL
    const url = `/uploads/${filename}`;

    console.log(`📸 Uploaded: ${filename} (${(file.size / 1024).toFixed(1)}KB)`);

    return new Response(
      JSON.stringify({
        url,
        filename,
        size: file.size,
        type: file.type,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (err) {
    console.error('Upload error:', err);
    return new Response(
      JSON.stringify({ error: 'Failed to upload file' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
