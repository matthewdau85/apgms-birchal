#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="artifacts/kms"
ARCHIVE="${1:-artifacts/backup/kms.tar.gz}"

if [[ ! -f "$ARCHIVE" ]]; then
  echo "KMS backup archive $ARCHIVE not found" >&2
  exit 1
fi

rm -rf "$TARGET_DIR"
mkdir -p "$TARGET_DIR"

tar -xzf "$ARCHIVE" -C "$TARGET_DIR"

echo "KMS artifacts restored to $TARGET_DIR"
