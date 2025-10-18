#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set. Export it before running this script." >&2
  exit 1
fi

BACKUP_DIR=${1:-backups}
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
OUTPUT_FILE="$BACKUP_DIR/apgms_${TIMESTAMP}.dump"

echo "Creating backup at $OUTPUT_FILE"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump is required but not installed. Install PostgreSQL client tools." >&2
  exit 1
fi

pg_dump --format=custom --dbname="$DATABASE_URL" >"$OUTPUT_FILE"

echo "Backup written to $OUTPUT_FILE"
