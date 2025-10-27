# APGMS Everything Orchestrator — Programming Task Breakdown

This backlog decomposes the unified "Everything Orchestrator" scope into deliverable-sized engineering tasks. Each task is framed for a two-person pairing session (4–8 ideal hours) with explicit acceptance signals and cross-team dependencies.

## 1. Repository & Developer Experience

### 1.1 Workspace Scaffolding
- Provision root configs (`.editorconfig`, `.gitattributes`, `.gitignore`) and baseline docs (LICENSE, SECURITY.md, CODEOWNERS, CONTRIBUTING, README quickstart).
- Set up pnpm workspace with hoisted TypeScript tooling shared across services.
- Acceptance: `pnpm i` completes, lint and type-check scripts runnable at root.

### 1.2 GitHub Actions Pipeline Suite
- Implement `ci.yml`, `e2e.yml`, and `security.yml` workflows per orchestrator brief.
- Wire job dependencies for lint → test → build; ensure Docker Compose stack boots in CI.
- Acceptance: All workflows pass on a dry-run branch using workflow dispatch.

### 1.3 Developer Tooling Scripts
- Add bash + PowerShell variants for `dev-up`, `db-reset`, `seed`, `e2e-run`, `k6-load`, `key-rotate`, and `export-dump` scripts.
- Provide `infra/dev/.env.example` and an `.env` generation helper (cross-platform safe).
- Acceptance: Scripts execute locally against Docker stack without manual edits.

## 2. Database Architecture & Security

### 2.1 Prisma Schema & Migrations
- Model Postgres schemas (`auth`, `tax`, `gst`, `paygw`, `finance`, `recon`, `audit`, `admin`).
- Introduce encryption metadata columns (DEK references) for sensitive tables.
- Acceptance: `pnpm -r db:migrate` creates expected tables; seeders insert demo data.

### 2.2 Seed Data Fabrication
- Implement deterministic seed routines: 2 orgs, 3 users each, GST/PAYGW samples, 25 bank lines, anomaly spike.
- Acceptance: Running `scripts/seed` idempotently refreshes demo dataset.

### 2.3 Envelope Encryption Layer
- Build KMS abstraction, DEK rotation registry, and per-table encryption helpers.
- Acceptance: Sensitive columns encrypted at rest, with successful decrypt in services.

## 3. Core Services Delivery

### 3.1 API Gateway Service
- Scaffold Fastify-based gateway with JWT auth (access + refresh), RBAC middleware, OpenAPI router, CSRF protection.
- Acceptance: Gateway serves `/healthz`, `/auth/login`, `/auth/refresh`, and sample protected route with RBAC enforcement.

### 3.2 Payments Service
- Implement `IPaymentRail` interface, PayTo/PayID mocks, ABA exporter, webhook simulator, mandate lifecycle.
- Acceptance: Payments state machine passes unit tests; webhook replay safety validated.

### 3.3 Reconciliation Service
- Deliver parsers for OFX/QIF/CSV, matching heuristics with scoring tiers, exception management actions, and audit event emissions.
- Acceptance: Fixture bank files auto-match ≥90% lines; unmatched queue created with audit trail.

### 3.4 Audit Service
- Create append-only audit log, digest chaining, RPT mint/verify/revoke endpoints, redaction pipeline.
- Acceptance: Unit tests confirm tamper detection; RPT lifecycle smoke-tested.

### 3.5 Registries & SBR Services
- Registries: Adapter interfaces, sandbox fixtures, consent logs, rate limiting/backoff caches.
- SBR: MTLS client scaffolding, BAS lodge/amend and STP submission flows with response archiving.
- Acceptance: Contract tests cover happy path + failure retries using mocked endpoints.

### 3.6 Connectors & Optional CDR Service
- Build OAuth flows and webhook ingestion for Xero/MYOB/QBO, conflict resolution hooks, and scheduled sync jobs.
- Implement optional Open Banking reader with consent storage, scheduled pulls into `recon.bank_txns`.
- Acceptance: Integration tests simulate provider callbacks; recon data populated.

### 3.7 Worker & Queue Infrastructure
- Configure worker service handling ingestion, recon batching, billing metering, exports, key rotation.
- Acceptance: Queue jobs persisted, processed, and logged with retries + dead-letter strategy.

## 4. Tax Engine (Python/FastAPI)

### 4.1 Core Calculation Endpoints
- Implement `/gst/calc`, `/paygw/calc`, `/bas/compile` endpoints with versioned rules loaders.
- Acceptance: Pytest suite verifies calculations against orchestrator fixtures.

### 4.2 Anomaly Detection Hooks
- Stub anomaly rules engine with deterministic spike scenario feeding audit events.
- Acceptance: Trigger returns structured anomaly payloads consumable by recon service.

### 4.3 Alembic + Poetry Tooling
- Configure Poetry project, Alembic migrations (if any), lint/test automation.
- Acceptance: `poetry run pytest` succeeds; FastAPI app documented via OpenAPI.

## 5. Web Application Experience

### 5.1 Design System & Shell
- Set up Vite + React + Tailwind + shadcn/ui + Framer Motion; implement layout shell (sidebar/topbar/breadcrumbs/notifications/theme switcher/i18n scaffold).
- Acceptance: Storybook or preview route demonstrates responsive, accessible shell.

### 5.2 Onboarding Wizard
- Build six-step wizard integrating registries service, mandate setup, BAS cycle config, user invitations, review with initial RPT minting.
- Acceptance: Playwright flow completes onboarding and seeds first tax period.

### 5.3 Core Modules
- Implement Dashboard, BAS Workspace, PAYGW module, Reconciliation Center, Payments console, Evidence & Audit portal, Settings, Admin ▸ Schedules Ingestion, Help center.
- Acceptance: Feature flag toggles allow incremental rollout; accessibility checks (axe + keyboard navigation) pass for each page.

### 5.4 Accessibility & PDF Exports
- Add WCAG 2.2 AA patterns, live regions, reduced-motion handling, tagged PDF exports with automated PAC checks in CI.
- Acceptance: Playwright accessibility audits green; generated PDFs pass tagging tests.

## 6. Payments, Reconciliation, Evidence Deep Dives

### 6.1 Payment Velocity & Webhooks
- Implement velocity caps, 3-strike pause, webhook replay safety, audit on transitions.
- Acceptance: Unit tests cover state machine edges and velocity enforcement.

### 6.2 Recon Threshold Automation
- Encode scoring thresholds (≥0.9 auto-match, etc.), review queues, batch actions, timeline with audit links.
- Acceptance: Recon UI updates in real time; audit viewer traces matches.

### 6.3 Evidence Management
- Deliver drag/drop document ingestion, evidence labeling, RPT mint/verify UI, canonical export with SHA-256 manifest.
- Acceptance: Export command produces manifest validated by checksum test.

## 7. Admin Ingestion Portal

### 7.1 Schedule Upload Pipeline
- Build 50MB streaming upload with virus-scan stub, format detection, parser to JSON fixtures, diff viewer, dry-run apply.
- Acceptance: Large fixture upload processed without memory spikes; audit log recorded.

### 7.2 Permissions & Audit
- Enforce OWNER/ADMIN access, integrate audit events, retention policies.
- Acceptance: Unauthorized access returns 403 with audit log entry.

## 8. Billing & Subscription Management

### 8.1 Stripe Integration
- Configure plans (Starter/Growth/Pro), seat management, metered events (reconciles, lodgements), dunning flows.
- Acceptance: Stripe test mode end-to-end scenario completes and updates internal entitlements.

### 8.2 Billing UI & Invoicing
- Build settings screens for billing, Aussie tax invoices with ABN/GST, customer portal integration.
- Acceptance: PDF invoice generator passes tests; portal link accessible in UI.

## 9. Observability & Reliability

### 9.1 Logging & Metrics
- Add pino/structlog logging, request IDs, Prometheus metrics, basic OpenTelemetry traces across services.
- Acceptance: `docker compose up` exposes Grafana dashboards with live metrics.

### 9.2 SLO Definition & Load Testing
- Document SLOs, configure k6 scenarios (BAS compile, recon match, debit path), ensure queues back-pressure gracefully.
- Acceptance: `scripts/k6-load.sh` executes and reports SLO compliance locally.

## 10. Security & Governance

### 10.1 Security Controls Implementation
- Enforce Argon2id hashing, rate limiting, RLS policies, JWT rotation, least-privilege DB users.
- Acceptance: Security integration tests validate RLS and rotation flows.

### 10.2 Threat Modeling & Incident Playbooks
- Produce STRIDE DFDs per service, DPIA/PIA artifacts, incident response runbooks, quarterly tabletop checklist.
- Acceptance: Docs reviewed and linked within `/docs/security` and `/docs/dsp-osf`.

### 10.3 Supply-Chain Management
- Configure signed commits, dependency updates, Trivy & sbom-verify gating, CycloneDX SBOM generation.
- Acceptance: `security.yml` workflow artifacts uploaded and verified.

## 11. Documentation & Evidence Pack

### 11.1 Architecture & Ops Docs
- Fill `/docs/architecture`, `/docs/ops`, `/docs/accessibility`, `/docs/security`, etc. with required content (C4 diagrams, runbooks, accessibility report).
- Acceptance: Docs reference live diagrams (PlantUML/Mermaid) and align with implemented features.

### 11.2 DSP OSF Evidence
- Populate `/docs/dsp-osf` with secure SDLC, change control, SOPs, monitoring/logging, evidence index.
- Acceptance: Cross-reference CI artifacts and repository controls.

### 11.3 Legal & Policy Stubs
- Draft ToS, Privacy Policy, billing terms, processor agreements, export/delete tooling docs.
- Acceptance: Documents reviewed by product/legal team and linked from README.

## 12. Infrastructure as Code & Deployment

### 12.1 Terraform Modules
- Deliver modules for VPC, RDS (PITR), Redis, object storage, ECS/Fargate (or Fly.io), ALB, TLS, blue-green deploys, rollbacks, backups, DR drill script.
- Acceptance: `terraform plan` for minimal prod profile completes without errors.

### 12.2 Secrets & Residency Controls
- Manage secrets via SSM, enforce data residency policies, BYO S3 option, export/delete tooling.
- Acceptance: Automated policy tests confirm residency constraints.

## 13. Testing & Quality Gates

### 13.1 Unit & Contract Coverage
- Achieve ≥85% coverage across services with targeted unit/contract tests.
- Acceptance: Coverage reports generated in CI and stored as artifacts.

### 13.2 Playwright End-to-End Suite
- Implement onboarding → BAS draft → recon match → debit → RPT mint scenario with accessibility and PDF tagging checks.
- Acceptance: `pnpm -w exec playwright test` passes in CI.

### 13.3 Load & Security Testing Automation
- Wire k6 load tests and security scans (Trivy, npm audit, Bandit, sbom-verify) into CI workflows.
- Acceptance: Failure gates block merges on threshold breaches.

---

Use this backlog as the implementation guide for sprint planning, tracing each orchestrator deliverable to actionable engineering work packages.
