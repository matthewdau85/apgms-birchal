# DSP Operational Security Framework – Evidence Index

This catalogue maps the OSF control families to concrete evidence in the Birchal gateway stack. All artefacts are version-controlled and refreshed after every production release.

## 1. Identity & Access Management

| Control | Evidence |
| --- | --- |
| Mandatory MFA enforced by IdP | Access tokens must present an `amr` claim containing `mfa` (see [`services/api-gateway/src/index.ts`](../../services/api-gateway/src/index.ts)). Requests missing this claim are rejected with `mfa_required`. |
| RBAC and organisational scoping | The authentication hook resolves the user from Prisma and applies tenant scoping on every query (`where: { orgId: request.auth.orgId }`). Admin-only endpoints (e.g. `/users`) require the `admin` role. |
| Service accounts | Non-interactive clients use dedicated OAuth clients with the `service-account` role; credentials and rotation cadence documented in [`docs/security/ASVS-mapping.md`](../security/ASVS-mapping.md#v4-access-control). |

## 2. API Security

| Control | Evidence |
| --- | --- |
| CORS hardening | Only origins listed in `ALLOWED_ORIGINS` are accepted. Requests from unknown origins are blocked during the CORS preflight. |
| Rate limiting | `@fastify/rate-limit` enforces 120 requests per minute per client. Headers expose the remaining quota for monitoring. |
| Body size caps | Fastify `bodyLimit` restricts payloads to 64KiB, preventing over-sized JSON submissions. |
| Anti-replay & idempotency | Mutating routes require an `Idempotency-Key`. Responses are stored in the `IdempotencyKey` table keyed by user and replayed when a duplicate key is presented. |
| Input validation | All request payloads use strict `zod` schemas; malformed input returns a structured `400` with no data leakage. |

## 3. Data Integrity & Audit

| Control | Evidence |
| --- | --- |
| Audit trail | Every sensitive route records an event in the `AuditEvent` table with user, org, IP, and contextual metadata. The audit feed is exported hourly to the SIEM. |
| Tamper resistance | Postgres row-level security is enabled in production and audit tables are append-only (no UPDATE permissions granted). Backups are signed with KMS keys; weekly restore drills logged under `ops/runbooks/backup-restore.md`. |
| Structured logging | Service logs redact secrets and emit normalized JSON lines for ingestion by Loki + Grafana. |

## 4. Operational Readiness

| Control | Evidence |
| --- | --- |
| Health & readiness | Dedicated `/health` and `/ready` endpoints gated by `X-Health-Check-Key`. Readiness runs `SELECT 1` to confirm DB connectivity. |
| Graceful shutdown | `SIGTERM` and `SIGINT` handlers drain Fastify and disconnect Prisma before exit. |
| Monitoring | `status/README.md` documents the Grafana dashboards tracking rate-limit saturation, auth failures, and webhook latency. Synthetic probes call the health endpoints every 30 seconds. |

## 5. Software Supply Chain

| Control | Evidence |
| --- | --- |
| SBOM & dependency governance | `scripts/sbom/generate.sh` produces a CycloneDX manifest checked into `docs/security/sbom/latest.json`. Dependabot rules enforce allowlisted packages only. |
| Distroless runtime | Dockerfiles under `infra/containers` use the `gcr.io/distroless/nodejs` base image and run the service as the non-root `app` user. |
| Build provenance | GitHub Actions sign artefacts with Sigstore and publish attestations stored in `docs/dsp-osf/slsa-attestations/`. |

## 6. SBR / AS4 Messaging

| Control | Evidence |
| --- | --- |
| AS4 stub evidence | Until the vendor selection finalises, outbound AS4 requests are recorded with message IDs and simulated receipts under [`docs/sbr/as4-pilot.md`](../sbr/as4-pilot.md). Test harness output is attached for each sprint. |
| Replay defence | Payment webhooks validate the `Idempotency-Key` before invoking downstream processing; evidence in [`tests/contract/webhook-idempotency.md`](../../tests/contract/webhook-idempotency.md). |

### Maintenance cadence

- Evidence review occurs fortnightly; Jira ticket `SEC-204` tracks updates and sign-off.
- The security and privacy teams co-own this index and archive superseded artefacts to S3 with retention policies aligned to OAIC requirements.
