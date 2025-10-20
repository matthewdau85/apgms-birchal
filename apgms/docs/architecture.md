# APGMS architecture overview

The APGMS platform is a modular financial services system that ingests data from
regulated partners, reconciles transactions and surfaces insights through a web
front-end. The source tree documents both the runtime topology and the supporting
infrastructure.

## System context

- **External users** interact via the React single-page app in [`webapp/`](../webapp).
- **Partner integrations** exchange banking, registry and tax data through
  service-specific connectors housed in [`services/`](../services).
- **Operational staff** use the observability stack in [`infra/observability/`](../infra/observability)
  to monitor health and respond to incidents defined in the [operations runbook](./ops/runbook.md).

## Core services

| Service | Responsibility | Key technology | Interfaces |
| --- | --- | --- | --- |
| API Gateway | Exposes REST endpoints for the frontend, handles authentication, mediates access to shared data models. | Node.js, Fastify, Prisma | `/health`, `/users`, `/bank-lines` (see [`services/api-gateway/src/index.ts`](../services/api-gateway/src/index.ts)) |
| Domain microservices (`audit`, `cdr`, `connectors`, `payments`, `recon`, `registries`, `sbr`) | Encapsulate product-specific logic for data ingestion and processing. | Node.js service skeletons | Message queue and service-to-service APIs (future work). |
| Tax engine | Performs tax calculations for ledger entries. | Python FastAPI | `POST /calculate` (implementation placeholder). |
| Worker | Executes asynchronous jobs such as reconciliation and report generation. | Node.js worker harness | Pulls jobs from queue (to be integrated). |
| Shared package | Provides Prisma ORM client and domain models reused across services. | TypeScript library | See [`shared/src/`](../shared/src). |

## Data storage

A shared PostgreSQL instance (managed via Prisma) persists core entities like users
and bank ledger lines. Terraform modules under [`infra/iac/modules/database`](../infra/iac/modules/database)
provision encrypted databases per environment with automated backups and secret
rotation hooks. Service code interacts with the database exclusively through the
[`prisma` client](../shared/src/db.ts) to ensure parameterised queries.

## Deployment topology

1. Infrastructure is defined as code in [`infra/iac`](../infra/iac) using Terraform.
2. CI/CD pipelines run `pnpm -r build` followed by the relevant service test suites.
3. Container images are published per service and orchestrated via the platform
   cluster (Kubernetes or ECS, depending on environment).
4. Observability dashboards from [`infra/observability/grafana`](../infra/observability/grafana)
   monitor service health, latency and error budgets.

## Security considerations

- Control alignment is tracked in the [OWASP ASVS control map](./ASVS-control-map.csv).
- The [TFN Security SOP](./security/TFN-SOP.md) prescribes incident handling and
  breach notification timelines.
- Secrets are injected via environment variables (see the Fastify bootstrap in
  [`services/api-gateway/src/index.ts`](../services/api-gateway/src/index.ts)) to avoid
  checked-in credentials.
- Load and resilience tests are executed with [`k6/debit-path.js`](../k6/debit-path.js)
  to validate critical transaction flows.

## Planned enhancements

- Implement asynchronous messaging between microservices for ingestion workflows.
- Expand automated test coverage for each service prior to production launch.
- Harden authentication by integrating with the external identity provider defined
  in the product roadmap.
