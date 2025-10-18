# Service topology and messaging contracts

The platform is composed of discrete Fastify-based services that communicate through Redis-backed [BullMQ](https://docs.bullmq.io/) queues. Each service loads configuration via `@apgms/shared` so that environment variables and queue prefixes are resolved consistently from the repository root `.env` file.

## Entrypoints and health checks

| Service | Entrypoint | Notes |
| --- | --- | --- |
| Connectors | `services/connectors/src/index.ts` | Ingests bank feeds and publishes reconciliation + audit jobs. |
| Recon | `services/recon/src/index.ts` | Runs a worker that performs ledger reconciliation and forwards payables + audit messages. |
| Payments | `services/payments/src/index.ts` | Exposes a `/payments` endpoint and processes lifecycle jobs to settle payables. |
| Audit | `services/audit/src/index.ts` | Stores audit trail events and exposes `/events` for inspection. |
| CDR | `services/cdr/src/index.ts` | Placeholder consent endpoints to support Consumer Data Right integrations. |
| Registries | `services/registries/src/index.ts` | Registry façade for entity lookups. |
| SBR | `services/sbr/src/index.ts` | Secure Business Reporting façade for form submission workflows. |

Each service registers `/health` so orchestration platforms can monitor process liveness.

## Queue contracts

The `@apgms/shared` workspace defines the queue contracts in `shared/src/messaging/contracts.ts`. BullMQ queues share the same Redis connection and are created with a service-specific prefix. The contracts include:

- **`bank-feed.ingest`** (`bankFeedIngestContract`): payload describing the full bank feed (`feedId`, `orgId`, source system, and individual entries). Produced by the connectors service and consumed by the reconciliation worker.
- **`payments.lifecycle`** (`paymentLifecycleContract`): payable lifecycle events generated during reconciliation and processed by the payments worker.
- **`audit.events`** (`auditEventContract`): canonical audit records emitted by all services; consumed by the audit worker to persist the event trail.

Helper utilities `createQueue`, `createWorker`, and `createRedisConnection` handle queue/worker instantiation while enforcing schema validation via Zod.

## Local startup

Each service has a `dev` script wired for `pnpm`:

```bash
pnpm --filter @apgms/connectors dev
pnpm --filter @apgms/recon dev
pnpm --filter @apgms/payments dev
pnpm --filter @apgms/audit dev
pnpm --filter @apgms/cdr dev
pnpm --filter @apgms/registries dev
pnpm --filter @apgms/sbr dev
```

Start Redis locally (for example using `docker compose up redis`) before launching services that rely on BullMQ.

## Tests

Run the full service test suite with:

```bash
pnpm --filter "@apgms/*" test
```

Unit tests exercise Fastify handlers and queue processors using lightweight stubs so they complete quickly without Redis.
