#!/usr/bin/env bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "usage: $0 <backup-archive>" >&2
  exit 1
fi

ARCHIVE_PATH="$1"
if [ ! -f "$ARCHIVE_PATH" ]; then
  echo "backup archive not found: $ARCHIVE_PATH" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
DB_URL="${DATABASE_URL:-postgresql://apgms:apgms@localhost:5432/apgms}"
PSQL_BIN="${PSQL_BIN:-psql}"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

>&2 echo "[restore] extracting $ARCHIVE_PATH"
tar -xzf "$ARCHIVE_PATH" -C "$TMP_DIR"

SQL_FILE="$TMP_DIR/db.sql"
if [ -s "$SQL_FILE" ]; then
  >&2 echo "[restore] applying database dump"
  "$PSQL_BIN" "$DB_URL" -v "ON_ERROR_STOP=1" -f "$SQL_FILE"
else
  >&2 echo "[restore] warning: database dump missing or empty"
fi

RESTORE_SRC="$TMP_DIR/artifacts/kms"
RESTORE_DEST="$REPO_ROOT/artifacts/kms"

>&2 echo "[restore] restoring KMS artifacts to $RESTORE_DEST"
rm -rf "$RESTORE_DEST"
mkdir -p "$RESTORE_DEST"
if [ -d "$RESTORE_SRC" ]; then
  cp -a "$RESTORE_SRC/." "$RESTORE_DEST/"
fi

echo "$ARCHIVE_PATH"
