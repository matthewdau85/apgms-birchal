#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

BACKUP_DIR="artifacts/backup/db"
BACKUP_FILE="${1:-$BACKUP_DIR/dump.sql}"

mkdir -p "$(dirname "$BACKUP_FILE")"

pg_dump "$DATABASE_URL" >"$BACKUP_FILE"

echo "Database backup written to $BACKUP_FILE"
