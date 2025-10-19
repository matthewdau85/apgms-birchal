# APGMS Threat Model

## System Context
- **Primary Users:** Platform operators manage bank lines and org data via the Fastify API Gateway and supporting services.
- **Key Assets:** Organization profiles, bank line records, Prisma-managed database credentials, CI/CD secrets, and audit evidence.
- **Entry Points:** Public Fastify endpoints (`services/api-gateway/src/index.ts`), background workers (`worker/src/index.ts`), service-to-service REST calls, and developer tooling invoked from CI pipelines.

## Trust Boundaries
1. **External Partner Boundary:** Requests originate from merchant partners and auditors across the public internet before hitting the API Gateway.
2. **Internal Service Boundary:** Authenticated service calls across the Kubernetes namespace using shared packages under `shared/` and secrets delivered through environment variables.
3. **Data Persistence Boundary:** PostgreSQL instances accessed through Prisma clients instantiated in `shared/src/db.ts` with per-service credentials.
4. **Operations Boundary:** Developer laptops and CI/CD pipelines that run migrations and deploy workloads defined in `infra/`.

## STRIDE Analysis

| Component | Threat | Description | Mitigations |
|-----------|--------|-------------|-------------|
| API Gateway (`services/api-gateway/src/index.ts`) | Spoofing | Attackers reuse leaked API tokens to impersonate partner tenants. | Enforce authentication middleware on every route and validate tenant ownership before reading or writing records.
| API Gateway (`services/api-gateway/src/index.ts`) | Tampering | JSON payloads could be altered in transit or replayed. | Require TLS termination at the ingress, validate request bodies with schema checks, and record idempotency keys for mutating actions.
| Audit Service (`services/audit/src/index.ts`) | Repudiation | Partners may deny submitting financial records after settlement. | Persist append-only audit entries and associate each entry with actor IDs and request IDs stored in immutable storage.
| Payments Service (`services/payments/src/index.ts`) | Information Disclosure | Over-broad queries could leak bank lines between organizations. | Scope Prisma queries to the requesting org ID and ensure access control checks before returning results.
| Worker (`worker/src/index.ts`) | Denial of Service | Malformed queue messages overwhelm worker resources. | Validate message schema before processing, enforce concurrency limits, and apply exponential backoff on retry.
| Infrastructure as Code (`infra/terraform`) | Elevation of Privilege | Misconfigurations could grant excessive database or Kubernetes privileges. | Enforce peer reviews on IaC changes and provision least-privilege service accounts with automated scanning.

## Mitigation Roadmap
- Build automated regression tests verifying authorization on every API route that accesses multi-tenant data.
- Integrate rate limiting and anomaly detection at ingress to absorb sudden traffic spikes.
- Expand audit logging coverage to include configuration changes and administrative actions.
- Periodically rotate database credentials and verify rotation in CI using smoke tests.
- Adopt runtime security monitoring to detect abuse of worker queues and long-running tasks.
