import { resolve } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate as drizzleMigrate } from 'drizzle-orm/better-sqlite3/migrator';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  isLegacyDb,
  LEGACY_MARKER_TABLE,
  MIGRATIONS_TABLE,
  stampBaseline,
  tableExists,
} from './migrate';

const MIGRATIONS_FOLDER = resolve(__dirname, '..', 'drizzle');

let sqlite: Database.Database;

beforeEach(() => {
  sqlite = new Database(':memory:');
});

afterEach(() => {
  sqlite.close();
});

describe('isLegacyDb', () => {
  it('returns false on a totally empty DB (fresh install)', () => {
    expect(isLegacyDb(sqlite)).toBe(false);
  });

  it('returns true when user tables exist but migrations table does not (push-style legacy)', () => {
    sqlite.exec(`CREATE TABLE ${LEGACY_MARKER_TABLE} (id TEXT PRIMARY KEY)`);
    expect(isLegacyDb(sqlite)).toBe(true);
  });

  it('returns false when both user tables and migrations table exist', () => {
    sqlite.exec(`CREATE TABLE ${LEGACY_MARKER_TABLE} (id TEXT PRIMARY KEY)`);
    sqlite.exec(
      `CREATE TABLE ${MIGRATIONS_TABLE} (id INTEGER PRIMARY KEY, hash TEXT NOT NULL, created_at NUMERIC)`,
    );
    expect(isLegacyDb(sqlite)).toBe(false);
  });
});

describe('stampBaseline + drizzleMigrate', () => {
  it('stamps a legacy DB so a follow-up migrate is a no-op', () => {
    // Simulate a legacy DB by applying the migration to create tables, then
    // dropping the migrations table — this is exactly the prod state.
    drizzleMigrate(drizzle(sqlite), { migrationsFolder: MIGRATIONS_FOLDER });
    sqlite.exec(`DROP TABLE ${MIGRATIONS_TABLE}`);

    // Insert sentinel data we expect to survive the stamp.
    sqlite.exec(
      `INSERT INTO seasons (id, year, start_date, end_date) VALUES ('s1', 2025, '2025-11-28', '2026-01-06')`,
    );

    expect(isLegacyDb(sqlite)).toBe(true);

    const stamped = stampBaseline(sqlite, MIGRATIONS_FOLDER);
    expect(stamped).toBeGreaterThan(0);

    // After stamping, drizzleMigrate should be a no-op (no DDL run, no extra rows).
    drizzleMigrate(drizzle(sqlite), { migrationsFolder: MIGRATIONS_FOLDER });

    const rowCount = sqlite.prepare(`SELECT COUNT(*) as c FROM ${MIGRATIONS_TABLE}`).get() as {
      c: number;
    };
    expect(rowCount.c).toBe(stamped);

    // Sentinel data preserved.
    const season = sqlite.prepare(`SELECT id, year FROM seasons WHERE id = 's1'`).get() as
      | { id: string; year: number }
      | undefined;
    expect(season).toEqual({ id: 's1', year: 2025 });
  });

  it('stamped hash matches what drizzleMigrate would compute (skip-on-match)', () => {
    // Apply migrations cleanly, capture the hash drizzle wrote.
    drizzleMigrate(drizzle(sqlite), { migrationsFolder: MIGRATIONS_FOLDER });
    const drizzleRow = sqlite
      .prepare(`SELECT hash FROM ${MIGRATIONS_TABLE} ORDER BY id LIMIT 1`)
      .get() as { hash: string };

    // On a fresh DB, stamp it ourselves and compare.
    const fresh = new Database(':memory:');
    try {
      stampBaseline(fresh, MIGRATIONS_FOLDER);
      const ourRow = fresh
        .prepare(`SELECT hash FROM ${MIGRATIONS_TABLE} ORDER BY id LIMIT 1`)
        .get() as { hash: string };
      expect(ourRow.hash).toBe(drizzleRow.hash);
    } finally {
      fresh.close();
    }
  });
});

describe('tableExists', () => {
  it('detects an existing table', () => {
    sqlite.exec('CREATE TABLE foo (id INTEGER)');
    expect(tableExists(sqlite, 'foo')).toBe(true);
  });

  it('returns false for missing tables', () => {
    expect(tableExists(sqlite, 'nope')).toBe(false);
  });
});
