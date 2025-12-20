#!/bin/sh
set -e

echo "Running database migrations..."
npx drizzle-kit push --force

echo "Initializing season..."
npx tsx scripts/init-season.ts

echo "Starting server..."
exec "$@"
