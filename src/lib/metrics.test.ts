import { describe, expect, it } from 'vitest';
import { normalizeRoute } from './metrics';

describe('normalizeRoute', () => {
  it('replaces UUID property IDs', () => {
    expect(normalizeRoute('/properties/123e4567-e89b-12d3-a456-426614174000')).toBe(
      '/properties/:id',
    );
  });

  it('replaces tour slugs', () => {
    expect(normalizeRoute('/tours/smith-family-2025')).toBe('/tours/:slug');
  });

  it('replaces upload paths', () => {
    expect(normalizeRoute('/uploads/photos/abc.jpg')).toBe('/uploads/:path');
  });

  it('collapses double slashes', () => {
    expect(normalizeRoute('/properties//foo')).toBe('/properties/foo');
  });

  it('leaves static routes alone', () => {
    expect(normalizeRoute('/api/properties')).toBe('/api/properties');
    expect(normalizeRoute('/rankings')).toBe('/rankings');
  });

  it('handles bare UUIDs anywhere in the path', () => {
    expect(normalizeRoute('/api/admin/123e4567-e89b-12d3-a456-426614174000/approve')).toBe(
      '/api/admin/:uuid/approve',
    );
  });
});
