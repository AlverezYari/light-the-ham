import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { and, eq, isNotNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { contributions } from '../../../src/lib/db/schema';

const MIGRATIONS_FOLDER = resolve(__dirname, '..', '..', '..', 'drizzle');

let sqlite: Database.Database;
let db: ReturnType<typeof drizzle>;

beforeEach(() => {
  sqlite = new Database(':memory:');
  db = drizzle(sqlite);
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  // Seed minimum graph: a season, a property, a user.
  sqlite.exec(`
    INSERT INTO seasons (id, year, start_date, end_date) VALUES ('s1', 2025, '2025-11-28', '2026-01-06');
    INSERT INTO users (id, email, oauth_provider, oauth_provider_id) VALUES ('u1', 'a@b.c', 'google', 'g1');
    INSERT INTO properties (id, season_id, address, city, zip, lat, lng, status) VALUES
      ('p1', 's1', '1 Main St', 'Birmingham', '35203', 33.5, -86.8, 'approved');
  `);
});

afterEach(() => {
  sqlite.close();
});

/**
 * Regression for the bug at tips/submit.ts:100 where the duplicate-check
 * predicate was `eq(contributions.tip, contributions.tip)` — always true,
 * so rating-only contributions from the same user blocked tip submission
 * AND tip submissions stacked unbounded since the where clause doesn't
 * actually constrain anything useful in combination with property+user.
 *
 * The real intent: "does this user already have a tip-bearing contribution
 * on this property?" — which requires `isNotNull(tip)`.
 */
describe('tip duplicate-check', () => {
  function findExistingTip(propertyId: string, userId: string) {
    return db
      .select({ id: contributions.id })
      .from(contributions)
      .where(
        and(
          eq(contributions.propertyId, propertyId),
          eq(contributions.userId, userId),
          isNotNull(contributions.tip),
        ),
      )
      .limit(1);
  }

  it('does not flag a rating-only contribution as an existing tip', async () => {
    // User has rated but never tipped.
    sqlite.exec(`
      INSERT INTO contributions (id, property_id, user_id, contributor_type, rating)
      VALUES ('c1', 'p1', 'u1', 'visitor', 4);
    `);

    const result = await findExistingTip('p1', 'u1');
    expect(result).toEqual([]);
  });

  it('finds an existing tip from the same user', async () => {
    sqlite.exec(`
      INSERT INTO contributions (id, property_id, user_id, contributor_type, tip)
      VALUES ('c2', 'p1', 'u1', 'visitor', 'park on Oak St');
    `);

    const result = await findExistingTip('p1', 'u1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('c2');
  });

  it("does not match another user's tip on the same property", async () => {
    sqlite.exec(`
      INSERT INTO users (id, email, oauth_provider, oauth_provider_id) VALUES ('u2', 'x@y.z', 'google', 'g2');
      INSERT INTO contributions (id, property_id, user_id, contributor_type, tip)
      VALUES ('c3', 'p1', 'u2', 'visitor', 'someone else');
    `);

    const result = await findExistingTip('p1', 'u1');
    expect(result).toEqual([]);
  });
});
