# APGMS

Local development spans multiple workspaces (Fastify API gateway, supporting services, the worker, and the Python tax engine) plus the shared Prisma schema. This guide covers end-to-end setup, migrations, testing, and observability.

## Prerequisites
- [Node.js 20+](https://nodejs.org/) with [`pnpm`](https://pnpm.io/) (run `corepack enable` once).
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose.
- [Python 3.11+](https://www.python.org/) if you prefer running the tax engine without Docker.

## 1. Install JavaScript dependencies
```bash
pnpm install
pnpm --filter @apgms/shared run prisma:generate
```
The second command generates the Prisma client that both the API gateway and the worker consume.

## 2. Environment configuration
Create a `.env` file at the repository root (or export the variables in your shell):
```env
DATABASE_URL=postgresql://apgms:apgms@localhost:5432/apgms?schema=public
SHADOW_DATABASE_URL=postgresql://apgms:apgms@localhost:5432/apgms_shadow?schema=public
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
LOG_PRETTY=true
```
The containers load this file automatically by virtue of mounting the repository root. The defaults match what `docker compose` provisions.

## 3. Run the platform locally
Start the core runtime (Postgres, Redis, API gateway, worker, tax engine) plus the observability stack:
```bash
docker compose up -d postgres redis api-gateway worker tax-engine prometheus grafana loki promtail
```
Key endpoints:
- API Gateway – http://localhost:3000 (health check at `/health`, metrics at `/metrics`)
- Tax Engine – http://localhost:8000 (health check at `/health`, metrics at `/metrics`)
- Prometheus – http://localhost:9090
- Grafana – http://localhost:3001 (admin/admin by default)
- Loki API – http://localhost:3100

Logs stream as structured JSON and are collected by Promtail → Loki. Use Grafana’s **Explore** view (select the *Loki* data source) to query logs by the `service` label.

## 4. Database migrations & seed data
Migrations live under `shared/prisma`. Typical workflow:
```bash
# Create a new migration
docker compose exec api-gateway pnpm --filter @apgms/shared prisma migrate dev --name <migration_name>

# Apply migrations + seed data from the host
pnpm --filter @apgms/shared prisma migrate deploy
pnpm tsx scripts/seed.ts
```
`seed.ts` populates an organisation, user, and sample bank lines for manual testing.

## 5. Running tests across workspaces
```bash
pnpm -r test
```
`pnpm -r` fans out to every package in the workspace, so each service contributes its own tests. You can scope to a single package with `pnpm --filter @apgms/api-gateway test` or run Playwright via `pnpm -w exec playwright test` once the web app is wired in.

## 6. Observability quickstart
The observability helpers are exposed from `@apgms/shared/src/observability`:
- `createLogger` provides consistent JSON structured logs with optional pretty-printing via `LOG_PRETTY=true`.
- `createMetricsRegistry`, `createHttpMetrics`, and `startMetricsServer` bootstrap Prometheus-style metrics collectors and expose `/metrics` endpoints.

Grafana ships with an “APGMS Overview” dashboard highlighting HTTP request rates and latency across services. Prometheus automatically scrapes the API gateway (`:3000/metrics`), worker (`:9100/metrics`), and tax engine (`:8000/metrics`).

## 7. Stopping the stack
```bash
docker compose down
```
Add `--volumes` if you want to reset Postgres, Prometheus, or Loki state.
