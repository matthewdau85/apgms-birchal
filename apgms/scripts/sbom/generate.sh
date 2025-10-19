#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUTPUT_FILE="${1:-$ROOT_DIR/docs/security/sbom/latest.json}"

mkdir -p "$(dirname "$OUTPUT_FILE")"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required to generate the SBOM" >&2
  exit 1
fi

echo "Generating CycloneDX SBOM at $OUTPUT_FILE"
PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
export PNPM_HOME

pnpm dlx @cyclonedx/cyclonedx-npm \
  --output-format json \
  --output-file "$OUTPUT_FILE" \
  --packages "$ROOT_DIR"

echo "SBOM written to $OUTPUT_FILE"
