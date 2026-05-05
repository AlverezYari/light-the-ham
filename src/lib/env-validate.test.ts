import { describe, expect, it } from 'vitest';
import { findMissingEnv } from './env-validate';

const SPECS = [
  { key: 'A', reason: 'a is required' },
  { key: 'B', reason: 'b is required' },
];

describe('findMissingEnv', () => {
  it('returns empty when all keys are present', () => {
    const lookup = (k: string) => ({ A: 'x', B: 'y' })[k] ?? '';
    expect(findMissingEnv(SPECS, lookup)).toEqual([]);
  });

  it('flags empty string as missing (not just undefined)', () => {
    const lookup = (k: string) => ({ A: 'x', B: '' })[k] ?? '';
    const missing = findMissingEnv(SPECS, lookup);
    expect(missing).toHaveLength(1);
    expect(missing[0].key).toBe('B');
  });

  it('returns all missing when the env is empty', () => {
    expect(findMissingEnv(SPECS, () => '')).toHaveLength(2);
  });
});
