/**
 * Database Connection
 *
 * This file sets up the SQLite database connection using better-sqlite3.
 * It's similar to creating an engine/session in SQLAlchemy.
 *
 * Usage in other files:
 *   import { db } from '@/lib/db';
 *   const results = await db.select().from(properties);
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

// Database file path - stored in /data directory at project root
const DB_PATH = process.env.DATABASE_URL || 'data/lighttheham.db';

/**
 * Create the SQLite connection.
 *
 * better-sqlite3 is synchronous (unlike most Node.js DB drivers).
 * This makes it faster but means it blocks the event loop during queries.
 * For our use case (small to medium traffic), this is fine.
 */
const sqlite = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
// WAL = Write-Ahead Logging, similar to PostgreSQL's WAL
sqlite.pragma('journal_mode = WAL');

/**
 * Create the Drizzle ORM instance.
 *
 * This is what you'll import and use throughout the app.
 * The `schema` parameter enables relational queries like:
 *   db.query.properties.findMany({ with: { photos: true } })
 */
export const db = drizzle(sqlite, { schema });

// Also export the raw sqlite connection for advanced use cases
export { sqlite };

// Re-export schema for convenience
export * from './schema';
