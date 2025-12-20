/**
 * Serve uploaded files
 *
 * Astro doesn't serve files added after build time,
 * so we need this API route to serve user uploads.
 */

export const prerender = false;

import type { APIRoute } from 'astro';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

export const GET: APIRoute = async ({ params }) => {
  const filePath = params.path;

  if (!filePath) {
    return new Response('Not found', { status: 404 });
  }

  // Prevent directory traversal
  const safePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
  const fullPath = path.join(UPLOADS_DIR, safePath);

  // Ensure the path is within uploads directory
  if (!fullPath.startsWith(UPLOADS_DIR)) {
    return new Response('Forbidden', { status: 403 });
  }

  if (!existsSync(fullPath)) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const file = await readFile(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    return new Response(file, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    console.error('Error serving upload:', err);
    return new Response('Error reading file', { status: 500 });
  }
};
