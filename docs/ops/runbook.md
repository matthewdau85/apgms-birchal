# Operations Runbook

This runbook covers day-to-day operations for the APGMS platform, including service ownership, incident handling, and deployment workflows. It consolidates guidance from the governance backlog into a single operational reference.

## Service Ownership

| Service | Stack | Primary Owner | Backup Owner | Contact |
| --- | --- | --- | --- | --- |
| API Gateway (`@apgms/api-gateway`) | Fastify + Prisma | Platform Engineering | Data Services | #apgms-ops (Slack) |
| Tax Engine (`@apgms/tax-engine`) | FastAPI | Platform Engineering | Finance Tech | #apgms-ops (Slack) |
| Worker (`@apgms/worker`) | Node.js (planned queue workers) | Data Services | Platform Engineering | #apgms-ops (Slack) |
| Shared Database (`apgms/shared`) | PostgreSQL 15 | SRE | Data Services | sre@yourdomain.example |
| Redis Cache | Redis 7 | SRE | Platform Engineering | sre@yourdomain.example |

Escalate security-sensitive issues directly to `security@yourdomain.example` (see `apgms/SECURITY.md`).

## Incident Response Checklist

1. **Detection**
   - Monitor API health endpoints (`/health` on Fastify and FastAPI services) via synthetic checks.
   - Review log streams emitted by Fastify (structured JSON) for error spikes or repeated 5xx responses.
2. **Triage**
   - Confirm scope: identify affected org IDs or endpoints (e.g. `/bank-lines`).
   - Capture timeline, errors, and relevant request IDs.
3. **Stabilise**
   - Roll back to the previous stable release if the issue correlates with a recent deployment (see Deployment & Rollback).
   - Apply feature flags or disable problematic endpoints if partial service is acceptable.
4. **Communicate**
   - Notify on-call leads and publish an initial incident entry on the status site (`apgms/status`). Target publication within 30 minutes of detection.
   - Update customers at least hourly until resolution.
5. **Resolution**
   - Implement fix, validate via automated tests (`pnpm -r test` once implemented) and targeted manual checks.
   - Confirm health checks pass and errors return to baseline.
6. **Post-incident**
   - Schedule a review within 5 business days using the template linked in Appendices.
   - Document root cause, corrective actions, and lessons learned in the knowledge base.

## Deployment and Rollback Procedures

### Prerequisites
- Ensure local environment variables (`.env`) define `DATABASE_URL` and `SHADOW_DATABASE_URL` for Prisma migrations.
- Postgres and Redis dependencies are provided locally via `docker compose up -d` (`apgms/docker-compose.yml`).

### Deployment Steps
1. `pnpm i` at repo root to install workspace dependencies.
2. `pnpm -r build` to compile all packages.
3. Run database migrations as required (future Prisma migrate scripts).
4. Deploy services as containers (build images per service, push to registry, update orchestration manifests).
5. Verify `/health` endpoints respond with `{ ok: true }`.
6. Execute smoke tests or automated integration suites.

### Rollback Steps
1. Re-deploy the last known good container images (tagged in release registry).
2. If database migrations were applied, run corresponding down migrations or restore from the most recent backup snapshot.
3. Re-validate health endpoints and ensure monitoring alerts clear.
4. Communicate rollback status to stakeholders and update incident timeline.

## Appendices

- **Monitoring Dashboards**: To be configured in Grafana (link TBD) aggregating Fastify request metrics, Postgres health, and Redis resource usage.
- **Post-incident Review Template**: Store the template under `docs/ops/post-incident-template.md` (pending creation). Until then, use the incident retrospective format defined by the SRE team wiki.
- **Runbooks for Domain Services**: Additional procedures for audit, connectors, and payments services will be added once those stubs gain functionality.
