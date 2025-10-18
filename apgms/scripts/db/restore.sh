#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set. Export it before running this script." >&2
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <path-to-backup>" >&2
  exit 1
fi

BACKUP_FILE=$1

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file $BACKUP_FILE does not exist." >&2
  exit 1
fi

if ! command -v pg_restore >/dev/null 2>&1; then
  echo "pg_restore is required but not installed. Install PostgreSQL client tools." >&2
  exit 1
fi

echo "Restoring database from $BACKUP_FILE"
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" "$BACKUP_FILE"
echo "Restore complete"
