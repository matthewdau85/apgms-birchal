# Release readiness review – integration/mega-merge

_Last updated: 2025-10-20 09:44 UTC_

## Pillar scores

| Pillar | Score (0-5) | Summary | Evidence |
| --- | --- | --- | --- |
| Security & Privacy | 1 | No authentication or authorization on any Fastify routes; user passwords remain stored in plaintext, and request bodies are trusted without validation. | `services/api-gateway/src/index.ts` shows open GET/POST routes without auth or schema enforcement, and the POST body is only cast via `as` rather than validated.【F:services/api-gateway/src/index.ts†L21-L66】 Plaintext credentials persist in the Prisma seed and schema.【F:scripts/seed.ts†L4-L31】【F:shared/prisma/schema.prisma†L18-L35】 |
| Reliability & Quality | 1 | Workspace tests/build succeed instantly because they contain only placeholders; no coverage for gateway behaviour or database flows, and POST `/bank-lines` lacks idempotency/error hardening. | Monorepo tests/build complete with stub projects only.【cfd062†L1-L6】【e4d515†L1-L8】 Gateway handler simply forwards Prisma errors without guards or retries.【F:services/api-gateway/src/index.ts†L42-L66】 |
| Observability & Operations | 2 | Basic Fastify logging is enabled and routes print at boot, but there is no structured tracing, metrics, or health of downstream services. | Logger configuration limited to Fastify defaults and a startup info log; no additional telemetry emitted.【F:services/api-gateway/src/index.ts†L14-L71】 |
| Delivery & Automation | 2 | CI builds/tests remain wired, but E2E pipeline still depends on Playwright + Docker steps that fail locally because Playwright is not installed; security workflow is a placeholder echo. | CI/E2E workflows still run pnpm build/test and docker+playwright without installing browsers.【F:.github/workflows/ci.yml†L1-L17】【F:.github/workflows/e2e.yml†L1-L17】 Local run shows Playwright command missing.【953174†L1-L2】 Security workflow only echoes “scanning”.【F:.github/workflows/security.yml†L1-L8】 |

## Verification matrix

| Capability | Status | Verification | Notes |
| --- | --- | --- | --- |
| Authentication (API & UI) | ❌ | No auth middleware or token checks on API routes.【F:services/api-gateway/src/index.ts†L21-L66】 | Routes are public; UI still logs to console only, so no login flow to exercise. |
| Password hashing | ❌ | Seed user keeps plaintext password and schema stores raw string.【F:scripts/seed.ts†L4-L31】【F:shared/prisma/schema.prisma†L18-L24】 | No hashing utility present in shared package. |
| Input validation (Zod) | ❌ | Request body cast uses TypeScript `as` without Zod parsing.【F:services/api-gateway/src/index.ts†L45-L56】 | Although Zod dependency exists, no validators are defined. |
| Security headers | ❌ | Fastify setup registers CORS with `origin: true` but adds no protective headers (CSP, HSTS, etc.).【F:services/api-gateway/src/index.ts†L14-L39】 | Need a shared plugin to enforce baseline headers. |
| Authorization gates | ❌ | No per-org or role checks before returning user/bank data.【F:services/api-gateway/src/index.ts†L23-L66】 | Everyone can read/write any organisation’s records. |
| Write idempotency | ❌ | POST `/bank-lines` inserts blindly without idempotency key or duplicate guard.【F:services/api-gateway/src/index.ts†L42-L66】 | Risk of duplicate ledger entries on retries. |

## Deltas since previous run

* Authn/z work remains outstanding despite being called out last review; there is still no guard layer on the gateway routes.【F:services/api-gateway/src/index.ts†L23-L66】
* Password hashing was expected but passwords continue to be persisted and seeded in plaintext.【F:scripts/seed.ts†L11-L15】【F:shared/prisma/schema.prisma†L18-L24】
* Zod validation was added as a dependency but is still unused in the request handlers.【F:services/api-gateway/src/index.ts†L45-L56】
* No new HTTP security headers were introduced—CORS remains wide-open and nothing else is configured.【F:services/api-gateway/src/index.ts†L16-L39】
* Route-level authorisation gates were not implemented; data access stays unrestricted.【F:services/api-gateway/src/index.ts†L23-L66】
* Idempotency protections for write endpoints are still missing; POST `/bank-lines` performs a raw create without safeguards.【F:services/api-gateway/src/index.ts†L42-L66】

## Release checklist

| Check | Command | Status | Notes |
| --- | --- | --- | --- |
| Install dependencies | `pnpm i` | ⚪ Not rerun | Assumed from prior workflow; rerun if cache cold. |
| Workspace build | `pnpm -r build` | ✅ Pass | Builds succeed because packages contain scaffold code only.【e4d515†L1-L8】 |
| Workspace tests | `pnpm -r test` | ✅ Pass | Tests finish instantly with placeholder suites; no assertions verified.【cfd062†L1-L6】 |
| Docker compose smoke | `docker compose up -d` | ⚪ Not run | Requires local Docker daemon; not executed in this environment. |
| Playwright E2E | `pnpm -w exec playwright test` | ❌ Fail | Command fails—Playwright CLI/browsers are not installed in repo or CI path.【953174†L1-L2】【F:.github/workflows/e2e.yml†L15-L17】 |
| Security scan | GitHub workflow | ⚠️ Warning | Workflow only echoes “scanning”, offering no actionable security coverage.【F:.github/workflows/security.yml†L1-L8】 |

**Release verdict:** ❌ **BLOCKED** – core security controls (auth, hashing, validation, gates) remain absent and E2E automation still fails, so integration/mega-merge is not release-ready.
