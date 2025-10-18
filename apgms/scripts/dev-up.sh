#!/usr/bin/env bash
set -euo pipefail

NO_BROWSER=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-browser)
      NO_BROWSER=1
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

log() {
  echo "[dev-up] $*"
}

cleanup() {
  trap - INT TERM EXIT
  if [[ -n "${API_PID:-}" ]]; then
    kill "$API_PID" 2>/dev/null || true
  fi
  if [[ -n "${WEB_PID:-}" ]]; then
    kill "$WEB_PID" 2>/dev/null || true
  fi
}

trap cleanup INT TERM EXIT

log "Starting Docker Compose services..."
docker compose up -d

log "Applying Prisma migrations..."
pnpm --filter @apgms/shared db:migrate

log "Generating Prisma client..."
pnpm --filter @apgms/shared prisma:generate

log "Seeding database with demo data..."
pnpm exec tsx scripts/seed.ts

log "Launching Fastify API..."
pnpm --filter @apgms/api-gateway dev &
API_PID=$!

log "Launching web application..."
pnpm --filter @apgms/webapp dev &
WEB_PID=$!

if [[ "$NO_BROWSER" -eq 0 ]]; then
  URL="http://localhost:5173"
  log "Opening browser at $URL"
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1 || true
  elif command -v open >/dev/null 2>&1; then
    open "$URL" >/dev/null 2>&1 || true
  elif command -v start >/dev/null 2>&1; then
    start "$URL" >/dev/null 2>&1 || true
  else
    log "Please open $URL manually."
  fi
fi

log "Development environment is ready. Press Ctrl+C to stop."

wait
