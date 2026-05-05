import { describe, expect, it } from 'vitest';
import { validateImage } from './image-validate';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'] as const;

// A minimal valid 1x1 transparent PNG (full file, 67 bytes).
// file-type v21 requires more than just the 8-byte signature to detect the format.
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);
// A minimal valid JPEG (1x1 pixel, ~125 bytes).
const JPEG_BYTES = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AB//Z',
  'base64',
);
// "Hello world" — not an image, regardless of file extension.
const TEXT_BYTES = Buffer.from('Hello, world!\n', 'utf-8');
// HTML — common XSS attack vector if served back.
const HTML_BYTES = Buffer.from('<!doctype html><script>alert(1)</script>', 'utf-8');

describe('validateImage', () => {
  it('accepts a real PNG', async () => {
    const result = await validateImage(PNG_BYTES, ALLOWED);
    expect(result).toEqual({ ok: true, mime: 'image/png', ext: 'png' });
  });

  it('accepts a real JPEG', async () => {
    const result = await validateImage(JPEG_BYTES, ALLOWED);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.mime).toBe('image/jpeg');
  });

  it('rejects plain text masquerading as an image', async () => {
    const result = await validateImage(TEXT_BYTES, ALLOWED);
    expect(result).toEqual({
      ok: false,
      error: 'File is not a recognized image format',
    });
  });

  it('rejects HTML (would be an XSS vector if accepted)', async () => {
    const result = await validateImage(HTML_BYTES, ALLOWED);
    expect(result.ok).toBe(false);
  });

  it('rejects an image format that exists but is not in the allowlist', async () => {
    // GIF magic bytes; allowlist excludes GIF in this test.
    const gif = Buffer.from('GIF89a', 'utf-8');
    const result = await validateImage(gif, ['image/jpeg']);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('not allowed');
  });
});
