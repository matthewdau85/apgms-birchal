# APGMS

Quickstart:
pnpm i
pnpm -r build
docker compose up -d
pnpm -r test
pnpm -w exec playwright test

## Observability

- API gateway readiness probe: `GET /ready` (returns `{ ready: true }` when Postgres is reachable).
- Prometheus scrape endpoint: `GET /metrics` exposed by the API gateway.
