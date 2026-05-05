#!/usr/bin/env bash
#
# snapshot-prod.sh — take a labeled point-in-time snapshot of the production
# SQLite database and upload it to Garage S3.
#
# Why: Litestream's continuous replica at lighttheham-litestream/db is a
# rolling backup — its layout changes as new WAL segments arrive, so it's
# not a stable "freeze this moment forever" artifact. Before any risky
# deploy (schema change, migration runner, infra rewrite), capture a named
# snapshot here so we have an explicit, untouched rollback point.
#
# Where snapshots land:
#   garage://lighttheham-snapshots/<label>-<utc-timestamp>.db
#
# Usage:
#   scripts/snapshot-prod.sh <label>
#
# Examples:
#   scripts/snapshot-prod.sh pre-phase1-migrations
#   scripts/snapshot-prod.sh pre-2026-season-cutover
#
# Prerequisites:
#   - kubectl configured for the homelab cluster (current-context = homelab)
#   - mc (MinIO client) configured with a 'garage' alias pointing at
#     the Garage S3 endpoint. To configure:
#       mc alias set garage https://<garage-public-endpoint> <key> <secret>
#   - Bucket lighttheham-snapshots exists. Create once with:
#       mc mb garage/lighttheham-snapshots
#
# To restore from a snapshot, see docs/RUNBOOK.md → "Restoring from a
# labeled snapshot".

set -euo pipefail

LABEL="${1:-}"
if [[ -z "$LABEL" || "$LABEL" =~ [[:space:]/] ]]; then
  echo "Usage: $0 <label>   # label must be non-empty, no spaces or slashes" >&2
  exit 1
fi

NAMESPACE="lighttheham"
DEPLOY="lighttheham"
APP_CONTAINER="app"
TIMESTAMP="$(date -u +%Y%m%d-%H%M%SZ)"
SNAPSHOT_NAME="${LABEL}-${TIMESTAMP}.db"
POD_TMP_PATH="/tmp/${SNAPSHOT_NAME}"
LOCAL_TMP_PATH="$(mktemp -d)/${SNAPSHOT_NAME}"
BUCKET="garage/lighttheham-snapshots"

cleanup() {
  rm -rf "$(dirname "$LOCAL_TMP_PATH")"
}
trap cleanup EXIT

# Resolve the actual pod (kubectl cp doesn't accept deploy/x, only pod/x).
POD="$(kubectl -n "$NAMESPACE" get pod -l app=lighttheham \
  -o jsonpath='{.items[0].metadata.name}')"
if [[ -z "$POD" ]]; then
  echo "✗ No running lighttheham pod found in namespace $NAMESPACE" >&2
  exit 1
fi

echo "→ Pod: $POD"
echo "→ Taking hot backup (sqlite3 .backup — consistent, doesn't lock readers)..."
kubectl -n "$NAMESPACE" exec "$POD" -c "$APP_CONTAINER" -- \
  sqlite3 /app/data/lighttheham.db ".backup '${POD_TMP_PATH}'"

echo "→ Copying snapshot out of the pod..."
kubectl -n "$NAMESPACE" cp "${POD}:${POD_TMP_PATH}" "$LOCAL_TMP_PATH" \
  -c "$APP_CONTAINER"

echo "→ Removing temp file from pod..."
kubectl -n "$NAMESPACE" exec "$POD" -c "$APP_CONTAINER" -- rm -f "$POD_TMP_PATH"

echo "→ Verifying integrity locally..."
sqlite3 "$LOCAL_TMP_PATH" "PRAGMA integrity_check" | head -3

SIZE="$(stat -c%s "$LOCAL_TMP_PATH" 2>/dev/null || stat -f%z "$LOCAL_TMP_PATH")"
echo "→ Snapshot size: $((SIZE / 1024)) KiB"

echo "→ Uploading to ${BUCKET}/${SNAPSHOT_NAME}..."
mc cp "$LOCAL_TMP_PATH" "${BUCKET}/${SNAPSHOT_NAME}"

echo
echo "✓ Snapshot complete:"
echo "    ${BUCKET}/${SNAPSHOT_NAME}"
echo
echo "  To restore later, see docs/RUNBOOK.md → 'Restoring from a labeled snapshot'."
