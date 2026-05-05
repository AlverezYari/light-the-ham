/**
 * UUID v4 / v7 / generic-format validator.
 *
 * Used at the edge of API handlers that take an `id` from a request body
 * before doing a DB lookup. Drizzle prevents SQL injection regardless, but
 * an early format check turns garbage requests into 400s without DB load.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}
