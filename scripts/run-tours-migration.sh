#!/bin/bash
# Run the tours migration on the SQLite database
# Usage: ./scripts/run-tours-migration.sh [path-to-database]

DB_PATH=${1:-"./data/lighttheham.db"}

if [ ! -f "$DB_PATH" ]; then
  echo "Database not found at: $DB_PATH"
  echo "Usage: ./scripts/run-tours-migration.sh [path-to-database]"
  exit 1
fi

echo "Running tours migration on: $DB_PATH"
sqlite3 "$DB_PATH" < "$(dirname "$0")/migrate-add-tours.sql"

if [ $? -eq 0 ]; then
  echo "Migration complete! Tours tables created."
  echo ""
  echo "Verifying tables:"
  sqlite3 "$DB_PATH" ".tables" | grep -E "tours|tour_stops"
else
  echo "Migration failed!"
  exit 1
fi
