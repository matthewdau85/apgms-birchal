#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DB_URL="${DATABASE_URL:-postgresql://apgms:apgms@localhost:5432/apgms}"
BACKUP_DIR="${BACKUP_DIR:-/tmp}"
PGDUMP_BIN="${PGDUMP_BIN:-pg_dump}"
PGDUMP_OPTS=${PGDUMP_OPTS:-}

mkdir -p "$BACKUP_DIR"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

cd "$REPO_ROOT"

>&2 echo "[backup] dumping database to temporary directory $TMP_DIR"
"$PGDUMP_BIN" --clean --if-exists --no-owner --format=plain --file "$TMP_DIR/db.sql" $PGDUMP_OPTS "$DB_URL"

mkdir -p "$TMP_DIR/artifacts"
if [ -d "$REPO_ROOT/artifacts/kms" ]; then
  cp -a "$REPO_ROOT/artifacts/kms" "$TMP_DIR/artifacts/"
else
  mkdir -p "$TMP_DIR/artifacts/kms"
fi

TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_PATH="$BACKUP_DIR/apgms-backup-$TIMESTAMP.tar.gz"

tar -czf "$BACKUP_PATH" -C "$TMP_DIR" db.sql artifacts

>&2 echo "[backup] archive created at $BACKUP_PATH"
echo "$BACKUP_PATH"
