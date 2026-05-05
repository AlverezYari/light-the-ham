#!/usr/bin/env node
/**
 * Database migration runner.
 *
 * Replaces `drizzle-kit push --force` in the container entrypoint.
 * `--force` was dangerous against a Litestream-restored DB — it could blow
 * away restored state when the local schema didn't match exactly.
 *
 * This runner handles three startup states:
 *
 *   1. Fresh DB (no user tables): apply all migrations from scratch.
 *   2. Legacy DB (tables exist but no __drizzle_migrations table): the prior
 *      push-based setup created the schema without versioning. Stamp the
 *      current journal entries as already applied, then run migrate (no-op).
 *   3. Migrated DB (tables + migrations table): run migrate normally.
 *
 * Drizzle's migrator decides whether to apply a migration by comparing
 * `_journal.json#entries[*].when` (a millis timestamp) to the most-recent
 * applied migration's `created_at`. Stamping the journal's `when` values
 * into __drizzle_migrations is what makes case 2 idempotent.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

export const MIGRATIONS_TABLE = '__drizzle_migrations';
export const LEGACY_MARKER_TABLE = 'properties';

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface Journal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

export function tableExists(sqlite: BetterSqliteDatabase, name: string): boolean {
  const row = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .get(name) as { name: string } | undefined;
  return !!row;
}

/**
 * A "legacy" DB has user tables but no __drizzle_migrations table —
 * i.e., schema was originally created by `drizzle-kit push`, not by versioned migrations.
 */
export function isLegacyDb(sqlite: BetterSqliteDatabase): boolean {
  if (tableExists(sqlite, MIGRATIONS_TABLE)) return false;
  return tableExists(sqlite, LEGACY_MARKER_TABLE);
}

/**
 * Mark every journal entry as already applied, without running any SQL.
 * Used once to onboard a legacy DB into the versioned migration flow.
 */
export function stampBaseline(sqlite: BetterSqliteDatabase, migrationsFolder: string): number {
  const journalPath = join(migrationsFolder, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf-8')) as Journal;

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id INTEGER PRIMARY KEY,
      hash text NOT NULL,
      created_at numeric
    )
  `);

  const insert = sqlite.prepare(`INSERT INTO ${MIGRATIONS_TABLE} (hash, created_at) VALUES (?, ?)`);

  for (const entry of journal.entries) {
    const sqlPath = join(migrationsFolder, `${entry.tag}.sql`);
    const sqlContent = readFileSync(sqlPath, 'utf-8');
    const hash = createHash('sha256').update(sqlContent).digest('hex');
    insert.run(hash, entry.when);
  }

  return journal.entries.length;
}

// ---------------------------------------------------------------------------
// Entry point: only runs when invoked directly (not when imported by tests).
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  // Lazy import so test files can exercise the helpers above without booting
  // the real DB connection.
  const { db, sqlite } = await import('../src/lib/db');
  const migrationsFolder = resolve(process.cwd(), 'drizzle');

  console.log('▶ Running database migrations...');

  if (isLegacyDb(sqlite)) {
    console.log('⚠ Legacy schema detected (user tables exist, no __drizzle_migrations table).');
    console.log('  Treating current schema as the baseline; stamping journal entries.');
    const stamped = stampBaseline(sqlite, migrationsFolder);
    console.log(`✓ Stamped ${stamped} migration(s) as baseline.`);
  }

  migrate(db, { migrationsFolder });
  console.log('✓ Migrations complete.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('✗ Migration failed:', err);
    process.exit(1);
  });
}
