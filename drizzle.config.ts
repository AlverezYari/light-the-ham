/**
 * Drizzle Kit Configuration
 *
 * This configures the `drizzle-kit` CLI tool for:
 * - Generating SQL migrations from schema changes
 * - Pushing schema directly to database (dev mode)
 * - Inspecting database structure
 *
 * Like Alembic for SQLAlchemy, but simpler.
 */

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  // Where to find your schema definitions
  schema: './src/lib/db/schema.ts',

  // Where to output generated migration files
  out: './drizzle',

  // Database type
  dialect: 'sqlite',

  // Database connection
  dbCredentials: {
    url: process.env.DATABASE_URL || 'data/lighttheham.db',
  },

  // Verbose output during migrations
  verbose: true,

  // Strict mode - fail on warnings
  strict: true,
});
