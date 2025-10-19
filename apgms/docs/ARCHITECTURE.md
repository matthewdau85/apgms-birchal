# APGMS Architecture Overview

## Monorepo Layout
The `apgms/` repository is a PNPM-managed monorepo containing:
- `webapp/`: React front-end served via the edge CDN.
- `services/`: Node.js microservices including `api-gateway`, `billing`, and `insights` packages under `services/*`.
- `worker/`: Background job runners handling asynchronous tasks, alerts, and scheduled reports.
- `shared/`: Cross-cutting libraries for domain models, schema validation, and telemetry utilities.
- `infra/`: Terraform, Helm charts, and deployment scripts for the multi-tenant SaaS platform.

## API Gateway Responsibilities
`services/api-gateway` provides the externally facing REST and GraphQL APIs. It terminates TLS, performs request authentication against Okta-issued JWTs, applies rate limiting, and orchestrates downstream calls to domain services. It also enriches responses with tenant metadata and writes structured audit logs to the OTEL collector.

## Database Entity Relationships
Persistent data resides in a managed Postgres cluster. Key aggregates include:
- `tenants` ⇨ `accounts` ⇨ `users`: hierarchical tenant relationships with cascade deletion controls.
- `users` ⇨ `sessions` and `api_keys`: authentication footprint with rotation history.
- `campaigns` ⇨ `offers` ⇨ `transactions`: marketing constructs powering APGMS activation flows.
- `events` ⇨ `event_attributes`: time-series telemetry normalized for analytics.
Refer to `infra/database/schema.sql` for canonical definitions.

## Request Flow
1. Client traffic arrives through the CDN and is forwarded to `api-gateway` via the load balancer.
2. `api-gateway` validates identity, enforces policy, and fans out to service-specific handlers (e.g., billing, insights).
3. Service calls hit Postgres through the Prisma ORM with caching via Redis for hot paths.
4. Responses are aggregated by the gateway, wrapped with tenant scoping headers, and returned to the client.
5. Side effects such as notifications or exports are dispatched to `worker` queues via NATS.
