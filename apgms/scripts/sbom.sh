#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

OUTPUT_FILE="${SBOM_OUTPUT:-sbom.json}"

npx --yes @cyclonedx/cyclonedx-npm --output-file "$OUTPUT_FILE" --json --fail-on-errors
