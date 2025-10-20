# APGMS release readiness review

_Commit: 8fc65ad5aed24521e148469bb0fd58104f719f00_

## Executive summary
APGMS is a pnpm-managed monorepo that groups TypeScript services, a React shell, a shared Prisma data layer, and a lightweight worker under one workspace umbrella.【F:apgms/package.json†L1-L1】【F:apgms/shared/src/db.ts†L1-L2】【F:apgms/webapp/src/main.tsx†L1-L1】【F:apgms/worker/src/index.ts†L1-L1】The Fastify API Gateway is the only TypeScript service with meaningful logic: it exposes health, listing, and mutation endpoints over the shared Prisma client while leaving authentication, validation, and secret handling unimplemented.【F:apgms/services/api-gateway/src/index.ts†L14-L76】A separate Python tax engine offers only a `/health` route, and the remaining service folders merely log start-up messages, underscoring how little production functionality exists today.【F:apgms/services/tax-engine/app/main.py†L1-L5】【F:apgms/services/audit/src/index.ts†L1-L1】【F:apgms/services/connectors/src/index.ts†L1-L1】

Operational scaffolding is equally thin. The shared package exports a raw Prisma client and seeds plaintext passwords, Playwright is empty, repo-level tests are placeholders, and documentation/runbooks are one-line stubs.【F:apgms/shared/src/db.ts†L1-L2】【F:apgms/scripts/seed.ts†L11-L24】【F:apgms/playwright.config.ts†L1-L1】【F:apgms/tests/e2e/.gitkeep†L1-L1】【F:apgms/docs/ops/runbook.md†L1-L1】Infrastructure relies on Docker Compose to start Postgres and Redis only, and Terraform files contain no deployable resources.【F:apgms/docker-compose.yml†L1-L12】【F:apgms/infra/iac/main.tf†L1-L1】The codebase is far from release-ready without major investments in security, validation, testing, and platform maturity.

## Pillar scores
| Pillar | Score | Notes |
| --- | --- | --- |
| Build / Install | 1 | pnpm workspaces exist, but most services are stubs with no build targets and package scripts just echo text, so CI never produces deployable artifacts.【F:apgms/pnpm-workspace.yaml†L1-L8】【F:apgms/services/api-gateway/package.json†L1-L18】【F:apgms/webapp/package.json†L1-L1】【F:apgms/worker/package.json†L1-L1】 |
| Testing | 0 | `pnpm -r test` calls echo scripts and every service/test directory only contains `.gitkeep` sentinels—no unit, integration, or e2e coverage exists.【F:apgms/package.json†L1-L1】【F:apgms/services/api-gateway/test/.gitkeep†L1-L1】【F:apgms/tests/e2e/.gitkeep†L1-L1】 |
| API contracts | 0 | Request bodies and queries are cast directly to inferred types before hitting Prisma, with no Zod/OpenAPI validation guarding inputs.【F:apgms/services/api-gateway/src/index.ts†L33-L60】【54f563†L1-L12】 |
| Security | 0 | All endpoints are unauthenticated, CORS reflects any origin, secrets are logged on boot, and the seed script persists plaintext passwords.【F:apgms/services/api-gateway/src/index.ts†L16-L66】【F:apgms/scripts/seed.ts†L11-L24】 |
| Privacy & PII | 0 | The `User` model stores passwords as plain strings and seeds keep `password123`, offering no hashing or masking controls.【F:apgms/shared/prisma/schema.prisma†L18-L35】【F:apgms/scripts/seed.ts†L11-L24】 |
| Observability | 1 | Fastify enables logging and exposes `/health`, but there are no readiness probes, metrics, tracing, or log redaction utilities.【F:apgms/services/api-gateway/src/index.ts†L18-L76】 |
| Performance & resiliency | 0 | Database calls have no timeouts, retries, rate limits, or defensive pagination beyond a simple clamp.【F:apgms/services/api-gateway/src/index.ts†L33-L60】 |
| Accessibility | 0 | The webapp is a console-log stub and the accessibility report is empty, with no automated axe/lighthouse tooling configured.【F:apgms/webapp/src/main.tsx†L1-L1】【F:apgms/docs/accessibility/report.md†L1-L1】【ca99aa†L1-L2】【e9099e†L1-L2】 |
| CI / CD | 1 | CI installs dependencies and runs the stub workspace scripts, while the security workflow just echoes text and e2e relies on an empty Playwright config.【F:apgms/.github/workflows/ci.yml†L1-L18】【F:apgms/.github/workflows/security.yml†L1-L9】【F:apgms/.github/workflows/e2e.yml†L1-L17】【F:apgms/playwright.config.ts†L1-L1】 |
| Docs & runbooks | 1 | Numerous documentation folders exist, but runbooks, security mappings, and policies consist of headings with no actionable guidance.【F:apgms/docs/ops/runbook.md†L1-L1】【F:apgms/docs/security/ASVS-mapping.md†L1-L1】【F:apgms/SECURITY.md†L1-L2】 |

## Findings
### P0 blockers
1. **Secrets printed to logs** – The API Gateway logs `DATABASE_URL`, exposing credentials to every downstream sink. Remove the structured secret log entirely.【F:apgms/services/api-gateway/src/index.ts†L16-L21】  
   _Fix:_
   ```ts
   app.log.info("environment loaded");
   ```
2. **No authentication or authorization** – Every route, including bank-line creation, is public, letting any caller exfiltrate or modify tenant data. Add a `preHandler` guard that checks an API key or JWT before continuing.【F:apgms/services/api-gateway/src/index.ts†L21-L66】  
   _Fix:_
   ```ts
   app.addHook("preHandler", async (req, rep) => {
     if (req.headers["x-api-key"] !== process.env.API_GATEWAY_KEY) {
       return rep.code(401).send({ error: "unauthorized" });
     }
   });
   ```
3. **Plaintext credential storage** – Prisma stores passwords as raw strings and the seed job inserts `password123`, violating security baselines. Hash passwords before persistence and rotate existing credentials.【F:apgms/shared/prisma/schema.prisma†L18-L22】【F:apgms/scripts/seed.ts†L11-L23】  
   _Fix:_
   ```ts
   const hashed = await bcrypt.hash(body.password, 12);
   await prisma.user.create({ data: { ...body, password: hashed } });
   ```

### P1 issues
1. **Missing request validation** – Handlers cast `req.body`/`req.query` to inline types, allowing malformed data to reach Prisma. Define Zod schemas and parse input before use.【F:apgms/services/api-gateway/src/index.ts†L33-L60】  
   _Fix:_
   ```ts
   const createLineSchema = z.object({
     orgId: z.string().min(1),
     date: z.coerce.date(),
     amount: z.coerce.number(),
     payee: z.string().min(1),
     desc: z.string().min(1),
   });
   const body = createLineSchema.parse(req.body);
   ```
2. **Reflective CORS policy** – `origin: true` mirrors any Origin header, enabling CSRF-style abuse. Replace it with an allowlist sourced from configuration.【F:apgms/services/api-gateway/src/index.ts†L16-L19】  
   _Fix:_
   ```ts
   await app.register(cors, {
     origin: process.env.ALLOWED_ORIGINS?.split(",") ?? [],
   });
   ```

### P2 opportunities
1. **Testing and e2e scaffolding are stubs** – Workspace tests and Playwright suites are empty, so CI cannot catch regressions. Wire real unit tests and author at least one e2e smoke spec.【F:apgms/package.json†L1-L1】【F:apgms/playwright.config.ts†L1-L1】  
   _Fix:_ `pnpm -r test` should invoke Vitest/Jest suites, and add a Playwright spec for `/health` once auth is in place.
2. **Security workflow is a no-op** – The dedicated security pipeline only runs `echo scanning`; no SCA or secret scanning protects the supply chain. Replace it with CodeQL or Dependabot/secret-scanning actions that fail on findings.【F:apgms/.github/workflows/security.yml†L1-L9】  
   _Fix:_
   ```yaml
   - uses: github/codeql-action/init@v3
   - uses: github/codeql-action/analyze@v3
   ```
3. **Docs lack actionable guidance** – Runbooks, accessibility reports, and security policies are headings without instructions, leaving operators blind during incidents.【F:apgms/docs/ops/runbook.md†L1-L1】【F:apgms/docs/accessibility/report.md†L1-L1】【F:apgms/SECURITY.md†L1-L2】  
   _Fix:_ Populate each document with concrete procedures before go-live.

## Verification of key claims
- **Schema validation at edges:** Not enforced; `rg "zod"` only finds dependency declarations, and handlers cast bodies directly.【54f563†L1-L12】【F:apgms/services/api-gateway/src/index.ts†L42-L60】
- **Webhook HMAC verification & idempotency:** Not found at this ref (`rg "webhook"` across services/shared/worker/webapp returns no matches; `rg "hmac"` returns nothing).【5d8e7b†L1-L2】【62539b†L1-L2】
- **Security headers & CSP:** Not found at this ref (`rg "helmet" apgms/services -n` yields no matches) and the gateway only registers permissive CORS.【45a763†L1-L1】【F:apgms/services/api-gateway/src/index.ts†L14-L21】
- **PII masking in logs:** Not implemented; the server logs the raw `DATABASE_URL` environment variable.【F:apgms/services/api-gateway/src/index.ts†L18-L21】
- **Healthz/readyz endpoints in CI smoke checks:** Only `/health` exists; searches for `/ready` or `readyz` return nothing, and CI merely runs stub Playwright suites without smoke curls.【F:apgms/services/api-gateway/src/index.ts†L21-L21】【a15609†L1-L1】【F:apgms/.github/workflows/e2e.yml†L1-L17】【F:apgms/playwright.config.ts†L1-L1】
- **SBOM/SCA & secret scanning:** Not found at this ref; the security workflow just echoes `scanning` and configures no scanners.【F:apgms/.github/workflows/security.yml†L1-L9】
- **Axe/Lighthouse accessibility checks:** Not found at this ref (`rg "axe"` and `rg "lighthouse"` return nothing), and the accessibility report is empty.【ca99aa†L1-L2】【e9099e†L1-L2】【F:apgms/docs/accessibility/report.md†L1-L1】

## Release checklist
| Item | Status | Command | Notes |
| --- | --- | --- | --- |
| Install & workspace build | FAIL | `pnpm install && pnpm -r run build` | Commands succeed but only trigger echo scripts; api-gateway lacks a production build output.【F:apgms/services/api-gateway/package.json†L1-L18】【F:apgms/webapp/package.json†L1-L1】【F:apgms/worker/package.json†L1-L1】 |
| Service & unit tests | FAIL | `pnpm -r run test` | Invokes echo stubs and no test files, so coverage is effectively zero.【F:apgms/package.json†L1-L1】【F:apgms/services/api-gateway/test/.gitkeep†L1-L1】 |
| Playwright / e2e | FAIL | `pnpm -w exec playwright test` | Configuration is empty and there are no specs to execute.【F:apgms/playwright.config.ts†L1-L1】 |
| Docker environment | WARN | `docker compose up -d` | Launches only Postgres and Redis; services need manual startup and env hardening.【F:apgms/docker-compose.yml†L1-L12】 |
| Smoke checks | FAIL | `curl http://localhost:3000/health` | Endpoint is unauthenticated, logs secrets, and lacks readiness semantics.【F:apgms/services/api-gateway/src/index.ts†L16-L66】 |

## Recommended PRs
| Title | Summary |
| --- | --- |
| Secure the API Gateway edge | Add API-key/JWT auth, strip secret logging, restrict CORS, and enforce Zod validation on requests.【F:apgms/services/api-gateway/src/index.ts†L16-L66】 |
| Harden identity & data handling | Hash user passwords, adjust Prisma schema, and update seeds to remove plaintext credentials.【F:apgms/shared/prisma/schema.prisma†L18-L35】【F:apgms/scripts/seed.ts†L11-L24】 |
| Establish real testing & security pipelines | Replace echo scripts with actual build/test commands, author smoke/e2e suites, and enable CodeQL/secret scanning in CI.【F:apgms/package.json†L1-L1】【F:apgms/.github/workflows/security.yml†L1-L9】 |
