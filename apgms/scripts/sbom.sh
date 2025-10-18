#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")"/.. && pwd)"
cd "$ROOT_DIR"

OUTPUT_FILE="sbom.json"

if [[ -f $OUTPUT_FILE ]]; then
  rm -f "$OUTPUT_FILE"
fi

npx --yes @cyclonedx/cyclonedx-npm --resolve-workspaces --spec-version 1.4 --output-file "$OUTPUT_FILE"

echo "CycloneDX SBOM generated at $ROOT_DIR/$OUTPUT_FILE"
