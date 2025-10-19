#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="artifacts/kms"
BACKUP_DIR="artifacts/backup"
ARCHIVE="${1:-$BACKUP_DIR/kms.tar.gz}"

if [[ ! -d "$SOURCE_DIR" ]]; then
  echo "KMS artifacts directory $SOURCE_DIR not found" >&2
  exit 1
fi

mkdir -p "$(dirname "$ARCHIVE")"

tar -czf "$ARCHIVE" -C "$SOURCE_DIR" .

echo "KMS backup written to $ARCHIVE"
