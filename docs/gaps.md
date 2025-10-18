# Gap Analysis

## Jobs, queues, and webhooks
- No job scheduler or message queue integrations are implemented. `docker-compose.yml` provisions Redis, but no code consumes it for background processing.
- Idempotency strategy is undefined; POST endpoints (e.g., `/bank-lines`) accept duplicate submissions without checks (`services/api-gateway/src/index.ts`).

## Security and validation
- Every public route lacks authentication and authorization, leaving data exposed (`services/api-gateway/src/index.ts`).
- Request validation is minimal: `/bank-lines` trusts the inbound payload apart from a try/catch. Schema validation (e.g., via Zod) is not enforced despite the dependency being available.
- CORS allows any origin, potentially exposing the API to CSRF-like risks when combined with missing auth (`services/api-gateway/src/index.ts`).
- Password handling for users is undefined; passwords are stored as plain strings in Prisma schema (`shared/prisma/schema.prisma`).

## Data model completeness
- Domain tables for POLICY, GATE, LEDGER, RPT, and AUDIT_BLOB are missing; Prisma schema currently models only organisations, users, and bank lines (`shared/prisma/schema.prisma`).
- Prisma migrations are absent; schema changes rely on manual generation.

## Service implementation gaps
- `services/audit`, `services/cdr`, `services/connectors`, `services/payments`, `services/recon`, `services/registries`, and `services/sbr` contain only placeholder console logs — real business logic, transport layers, and persistence are TBD.
- `services/tax-engine` exposes only a health check; taxation logic, data access, and integration points remain TBD (`services/tax-engine/app/main.py`).
- `worker/src/index.ts` is a stub that logs "worker" and should be replaced with actual queue/message consumers.

## Web application
- `webapp/src/main.tsx` merely logs "webapp"; routing, pages, authentication flows, and API integrations are unimplemented.

## Documentation and operations
- `.env` loading is assumed but no sample configuration is committed; onboarding documentation should specify required variables for each service.
- Monitoring, metrics, and alerting are absent across services.
