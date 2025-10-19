#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

BACKUP_FILE="${1:-artifacts/backup/db/dump.sql}"

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file $BACKUP_FILE not found" >&2
  exit 1
fi

psql "$DATABASE_URL" <"$BACKUP_FILE"

echo "Database restored from $BACKUP_FILE"
