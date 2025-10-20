# Architecture Overview

## Monorepo layout
- `apgms/package.json` defines a PNPM workspace that groups service packages (`services/*`), the React webapp, shared libraries, and the background worker.
- Shared database access is provided via `shared/src/db.ts`, which instantiates a singleton Prisma client for reuse across services.

## Runtime components
| Component | Runtime | Entry point | Responsibilities |
| --- | --- | --- | --- |
| API Gateway | Node.js (Fastify) | `services/api-gateway/src/index.ts` | Hosts HTTP routes for health checks, user listing, and bank line CRUD. Loads configuration from `.env`, enables permissive CORS, and talks to Postgres through Prisma. |
| Tax Engine | Python (FastAPI) | `services/tax-engine/app/main.py` | Exposes a `/health` endpoint; business logic is TBD. |
| Audit, CDR, Connectors, Payments, Recon, Registries, SBR services | Node.js | `services/<name>/src/index.ts` | Currently log a startup message only; implementation TBD. |
| Worker | Node.js | `worker/src/index.ts` | Placeholder worker process; currently logs "worker" only. |
| Webapp | React/Vite | `webapp/src/main.tsx` | Placeholder SPA entry point logging "webapp" only; UI TBD. |

## Data layer
- Prisma models `Org`, `User`, and `BankLine` are defined in `shared/prisma/schema.prisma`, establishing relationships between organisations, their users, and imported bank statement lines.
- All services that need database access rely on the shared Prisma client; currently only the API Gateway issues queries.

## Infrastructure
- `docker-compose.yml` provisions Postgres 15 and Redis 7 containers for local development; no application services are orchestrated yet.
- Environment variables (e.g., `DATABASE_URL`) are expected in a repo-level `.env` file that the API Gateway loads on startup.

## Inter-service interactions
- Presently, only the API Gateway interacts with the database; there is no implemented messaging or RPC between services.
- Placeholder services and the worker emit console logs but expose no network interfaces or job handlers yet, so integration points remain TBD.

## Observability
- The API Gateway enables Fastify's default logger, emitting structured logs for requests and errors; no metrics or tracing integrations are present.

## Security surface
- No authentication or authorization checks are implemented in any exposed endpoint; API Gateway routes are publicly accessible.
- Requests accept JSON bodies without schema validation beyond Prisma constraints; input sanitisation is minimal (simple try/catch around `/bank-lines` insert).
- CORS is configured to allow any origin, widening exposure for browser clients.
- No rate limiting, request signing, or CSRF protections are present.
