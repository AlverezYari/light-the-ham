#!/bin/sh
set -e

echo "Running database migrations..."
# Versioned migrations via drizzle-orm. Replaces the old `drizzle-kit push --force`,
# which was destructive against a Litestream-restored DB. The runner handles three
# states: fresh DB, legacy push-style DB, already-migrated DB. See scripts/migrate.ts.
pnpm exec tsx ./scripts/migrate.ts

echo "Initializing season..."
pnpm exec tsx ./scripts/init-season.ts

echo "Starting server..."
exec "$@"
