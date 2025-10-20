# Release Hardening Tasks (integration/mega-merge)

Derived from [`reports/release-review.md`](../reports/release-review.md). Track completion of the minimal changes required for release readiness.

## P0 — Blockers

- [ ] Harden API gateway edge authentication, validation, and idempotency.
  - **Scope:** `services/api-gateway/src/index.ts`, `.env.example` (add `API_GATEWAY_KEY`, `ALLOWED_ORIGINS`, `IDEMPOTENCY_TTL_SEC`).
  - **Includes:** API-key guard on all non-GET routes, allowlisted CORS, helmet/CSP, request ID hook, Zod schemas for request/response, idempotency cache, `/ready` endpoint, `/metrics` registration, removal of secret logging.
  - **Smoke:** `pnpm --filter @apgms/api-gateway dev` then `curl -H "x-api-key: $API_GATEWAY_KEY" http://localhost:3000/ready`.

- [ ] Hash seed user credentials and stop seeding plaintext passwords.
  - **Scope:** `scripts/seed.ts`, shared dependencies (`package.json`, `pnpm-lock.yaml`).
  - **Includes:** Add `bcryptjs`, hash with configurable `SEED_USER_PASSWORD`, document env default.
  - **Smoke:** `pnpm exec tsx scripts/seed.ts`.

## P1 — Important

- [ ] Replace placeholder workspace scripts with real TypeScript builds/tests.
  - **Scope:** `packages/shared`, `services/*`, `apps/webapp`, `workers/*` package manifests and tsconfigs.
  - **Includes:** Ensure `pnpm -r run build` and `pnpm -r run test` perform real work (no `echo`), enable TypeScript `strict`.
  - **Smoke:** `pnpm -r run build && pnpm -r run test`.

- [ ] Implement real security gates in CI.
  - **Scope:** `.github/workflows/security.yml` (and related CI workflows).
  - **Includes:** Checkout, pnpm install, run gitleaks (or equivalent secret scan), dependency audit/SBOM (CycloneDX), ensure failures break the build, upload artifacts.
  - **Smoke:** `act -j scan` or rerun GitHub Actions workflow.

## P2 — Nice to Have

- [ ] Add minimal observability instrumentation.
  - **Scope:** `services/api-gateway/src/index.ts`, shared monitoring helpers.
  - **Includes:** `/ready` readiness check (DB + Redis), register `@fastify/metrics`, ensure structured logs include request IDs, document scrape path.
  - **Smoke:** `curl http://localhost:3000/metrics` after running the gateway locally.

- [ ] Flesh out operational documentation.
  - **Scope:** `README.md`, `docs/runbook.md`, `docs/security.md`, `docs/privacy.md`.
  - **Includes:** Provide dev up instructions, env var reference, smoke steps, rollback guide, summarize privacy/security controls.
  - **Smoke:** Documentation review.

---

Tick each box via pull requests targeting `integration/mega-merge`. Update this checklist as tasks complete or scope changes.
