# Architecture Overview

The APGMS repository is organised as a pnpm monorepo under `apgms/` with shared tooling, TypeScript services, and a Python-based tax engine.
The production topology is intentionally lightweight to favour rapid prototyping while maintaining clear seams for future domain services.

## System Context

- **Client channels**: A forthcoming React/Vite web application (`apgms/webapp`) and an internal status site (`apgms/status`). Both are currently placeholders awaiting feature build-out.
- **APIs**: A Fastify API gateway (`apgms/services/api-gateway`) fronts the Postgres data store via Prisma. Planned downstream services (audit, CDR, connectors, payments, recon, registries, SBR) exist as TypeScript stubs to isolate business domains. A Python FastAPI tax engine (`apgms/services/tax-engine`) is provided for fiscal calculations.
- **Data platform**: Shared Prisma models in `apgms/shared/prisma/schema.prisma` define multi-tenant organisations, users, and bank transaction lines persisted to PostgreSQL. Redis is provisioned for ephemeral coordination (future session caching / queues).

## Key Components and Dependencies

| Component | Technology | Notes |
| --- | --- | --- |
| API Gateway | Fastify 5, TypeScript ES modules | Exposes `/health`, `/users`, `/bank-lines` endpoints, loads `.env` via `dotenv`, and depends on the shared Prisma client for database access. |
| Shared data layer | Prisma Client 6 | Provides singleton Prisma instance (`apgms/shared/src/db.ts`) used by TypeScript services. |
| Tax Engine | FastAPI (Python) | Minimal health check endpoint; designed for computational workloads that favour Python ecosystems. |
| Data Store | PostgreSQL 15 | Defined in `apgms/docker-compose.yml`; credentials managed through `.env` (`DATABASE_URL`, `SHADOW_DATABASE_URL`). |
| Cache / Coordination | Redis 7 | Provisioned in `apgms/docker-compose.yml` for future background job coordination and rate limiting. |
| Tooling | pnpm, tsx, Typescript 5.9 | Workspace-level scripts (`pnpm -r build`, `pnpm -r test`) orchestrate builds across packages. |

## Integration View

1. Clients (webapp, partner integrations) call the API gateway over HTTPS.
2. The gateway routes requests to Prisma to query or mutate the `Org`, `User`, and `BankLine` tables defined in the schema. Responses are returned as JSON with consistent logging through Fastify.
3. Domain services (audit, payments, etc.) are poised to subscribe to future event streams emitted by the gateway or worker processes (`apgms/worker`) once they move beyond stubs.
4. The tax engine is exposed separately for specialised fiscal calculations and can be invoked asynchronously via background jobs.

## Deployment Topology and Environments

- **Local development**: Run `pnpm i`, `pnpm -r build`, and `docker compose up -d` from `apgms/` to provision PostgreSQL and Redis (`apgms/README.md`). Services can then be started via package scripts (e.g. `pnpm --filter @apgms/api-gateway dev`).
- **Continuous integration**: Linting and testing (when implemented) should execute using the workspace scripts to ensure shared dependencies remain in sync.
- **Production**: Each service is containerised independently; infrastructure-as-code stubs exist under `apgms/infra/iac` for Terraform-based provisioning of the runtime environment. Deployments should target managed Postgres and Redis offerings with secrets injected through environment variables.
- **Observability**: Fastify’s built-in structured logging is enabled; additional traces/metrics must be added before launch. Postgres connections should be monitored for saturation.

## Architectural Decision Records

Formal ADRs have not yet been captured. The following decisions are implicit and should be documented explicitly in future iterations:
- Adoption of pnpm workspaces to co-locate TypeScript and Python services.
- Centralised Prisma schema to enforce consistent data definitions across services.
- Fastify as the HTTP server of choice for the gateway because of its performance and plugin ecosystem.
- Python FastAPI for the tax engine to leverage existing actuarial libraries.

## Open Questions

- Authentication and authorisation models are undeveloped; the API gateway currently exposes sensitive data (e.g. list of users) without access control.
- Message bus / eventing strategy for cross-service communication remains undefined.
- Infrastructure automation is stubbed; Terraform modules need to be fleshed out before cloud deployment.
