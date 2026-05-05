import { describe, expect, it } from 'vitest';

/**
 * Smoke test — confirms the test runner itself is wired up.
 * Add real tests next to the code they exercise (e.g. foo.ts -> foo.test.ts).
 */
describe('smoke', () => {
  it('runs a test', () => {
    expect(1 + 1).toBe(2);
  });
});
