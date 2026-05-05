import { describe, expect, it } from 'vitest';
import { isValidUuid } from './uuid';

describe('isValidUuid', () => {
  it('accepts a canonical v4 UUID', () => {
    expect(isValidUuid('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
  });

  it('accepts uppercase', () => {
    expect(isValidUuid('123E4567-E89B-12D3-A456-426614174000')).toBe(true);
  });

  it('rejects short strings', () => {
    expect(isValidUuid('not-a-uuid')).toBe(false);
    expect(isValidUuid('')).toBe(false);
  });

  it('rejects strings with extra characters', () => {
    expect(isValidUuid('123e4567-e89b-12d3-a456-426614174000-extra')).toBe(false);
    expect(isValidUuid("'; DROP TABLE properties; --")).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isValidUuid(undefined)).toBe(false);
    expect(isValidUuid(null)).toBe(false);
    expect(isValidUuid(12345)).toBe(false);
    expect(isValidUuid({})).toBe(false);
  });

  it('rejects UUID-shaped strings with non-hex characters', () => {
    expect(isValidUuid('zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz')).toBe(false);
  });
});
