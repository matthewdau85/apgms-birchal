# APGMS

Quickstart:
pnpm i
pnpm -r build
docker compose up -d
pnpm -r test
pnpm -w exec playwright test

## Smoke testing the API gateway

Run the lightweight Playwright smoke suite to confirm the gateway is healthy:

1. Start the gateway locally (for example with `docker compose up -d`).
2. Execute `pnpm -w exec playwright test` from the repository root.

The smoke runner targets `http://localhost:3000` by default. Override it by
exporting `PLAYWRIGHT_BASE_URL` (or `GATEWAY_BASE_URL`) before running the
command. If the gateway requires authenticated GET requests, provide a JSON
object of headers via `PLAYWRIGHT_EXTRA_HEADERS`.
