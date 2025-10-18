# Architecture overview

This repository models the flows that power Birchal's treasury platform. The system is composed of a TypeScript monorepo of edge services, a FastAPI tax engine, and a simple web cockpit used by operations analysts.

## C4 context

- **Clients** — the `webapp` SPA consumes the public API Gateway and specialist services (payments, connectors) for real-time insights.
- **API Gateway** — central Fastify service that fronts the relational database, enforces authentication via API keys, and provides curated views of operational data.
- **Satellite services** — supporting bounded contexts (`connectors`, `payments`, `tax-engine`) manage external integrations and domain-specific workflows. They communicate via REST today but could easily move to event streams.
- **Shared data layer** — the Prisma client in `shared/` encapsulates access to the Postgres datastore and is reused by all Node services.

## Containers

| Service | Responsibility | External deps |
| ------- | -------------- | -------------- |
| **API Gateway** | Authenticated access to users and bank lines with validation, rate limiting stubs, and orchestration hooks. | Postgres, downstream services |
| **Connectors** | Tracks open banking aggregators, connection status, and supports manual resyncs. | None (in-memory demo) |
| **Payments** | Accepts payment instructions, enforces state transitions, and exposes operational reports. | None (in-memory demo) |
| **Tax Engine** | Calculates GST for AU/NZ and surfaces jurisdiction metadata. | None |

## Sequences

1. **Bank feed ingestion** — connectors ingest transactions, then push normalized bank lines into Postgres via the API gateway.
2. **Payment approvals** — ops teams schedule payments through the `payments` service which validates transitions before funds flow.
3. **Tax filing** — the API gateway queries the tax engine for a filing preview before locking returns in the registry service.

## Cross-cutting concerns

- **Authentication** — API Gateway uses header API keys, while internal services expect network-level controls. Extending to JWT or mTLS is an open roadmap item.
- **Validation** — all request payloads are validated with Zod (Node) and Pydantic (Python) to ensure safe defaults.
- **Observability** — Fastify logger output is structured JSON and can be ingested by Stackdriver/ELK. Add OpenTelemetry to capture traces across services.
- **Resilience** — connectors/payments keep in-memory state and expose health endpoints; production versions should persist to Redis/Postgres and include retry policies.

## Next steps

- Introduce message queues between gateway and satellites to decouple writes.
- Harden security with signed service-to-service requests.
- Expand the tax engine to support BAS generation and audit exports.
