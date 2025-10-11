# APGMS Phase 1 + Phase 2 Delivery Roadmap

This document summarises the staged delivery approach for bootstrapping APGMS from the existing monorepo to the compliance posture outlined in the combined prompt pack.

## Objectives

1. Establish a runnable developer platform that satisfies mandated tooling (pnpm, Poetry, Docker Compose) and CI gates.
2. Deliver Phase 1 core features spanning services, infrastructure, UX, and compliance foundations.
3. Extend to Phase 2 partner readiness with live integrations, security hardening, and operational playbooks.

## Implementation Strategy

### Phase 1

1. **Repository & Tooling**
   - Align root configuration with pnpm workspaces and Poetry-managed Python packages.
   - Define Docker Compose stacks for application services plus PostgreSQL, Redis, Mailhog, Prometheus, and Grafana.
   - Create GitHub Actions workflows covering build, test, security, and Playwright end-to-end suites.

2. **Service Layer**
   - Scaffold Node/TypeScript services for the API gateway, payments, reconciliation, audit, and background worker.
   - Introduce a FastAPI Python tax-engine with OpenAPI-first design and shared DTO packages across the monorepo.

3. **Database Foundations**
   - Implement schemas, migrations, and seed data for organisations, tax domains, finance, reconciliation, and auditing with row-level security policies.
   - Provide realistic seed organisations, registrations, and historical lodgements for deterministic tests.

4. **Security Baseline**
   - Integrate JWT access/refresh tokens, argon2id password storage, RBAC, CSRF protection, idempotency keys, rate limiting, and append-only audit logging.
   - Document ASVS Level 2 mappings within `/docs/security`.

5. **Feature Highlights**
   - Build the admin ingestion portal for PDF/CSV/JSON schedule uploads with diff and dry-run functionality.
   - Enable reconciliation imports (OFX/QIF/CSV) with heuristics, scoring, and exception queues that emit audit events.
   - Deliver payments mock services including PayTo/PayID simulators and ABA exports with mandate lifecycle tracking.
   - Implement GST/PAYGW calculators, BAS compilation, and evidence token minting within the tax engine.

6. **Frontend Experience**
   - Create a shadcn/ui-powered design system supporting dark/light modes, accessibility, and responsive layouts.
   - Ship pages for Dashboard, BAS, PAYGW, Reconciliation, Payments, TaxVault evidence, Settings, Admin Ingestion, Help, and a six-step onboarding wizard.

7. **Operational Readiness**
   - Provide structured logging, Prometheus metrics, starter Grafana dashboards, privacy/retention controls, and comprehensive documentation (architecture, quickstart, runbooks, OpenAPI bundles).

8. **Testing**
   - Maintain ≥85% coverage via unit, contract, and Playwright e2e tests covering onboarding → BAS draft → reconciliation → payment debit → RPT token minting.

### Phase 2

1. **ATO Integrations**
   - Implement `/services/sbr` for MTLS-secured SBR BAS and STP Phase 2 submissions with message signing, logging, and admin controls for certificate management.
   - Persist receipts, correlation IDs, and archive responses while redacting sensitive payloads.

2. **Compliance & Governance**
   - Expand `/docs/dsp-osf` with secure SDLC, change control, vulnerability management, personnel matrices, and incident response procedures.
   - Add CI gates for CycloneDX SBOM generation/verification, Trivy scans, and signed commit enforcement.

3. **External Connectivity**
   - Build registries service for ABN/GST/PAYGW lookups with consent logging.
   - Introduce accounting connectors (Xero/MYOB/QBO) with OAuth flows, sync policies, and UI controls.
   - Implement live PayTo/PayID adapter with webhook HMAC rotation, velocity rules, and PCI DSS scope documentation.
   - Provide CDR-based bank feed ingestion with consent UX and reconciliation integration.

4. **Security Enhancements**
   - Apply envelope encryption backed by KMS for TFN and sensitive data with rotation CLI and audit trails.
   - Produce threat models (STRIDE, DFDs), DPIA, and incident response playbooks under `/docs/security`.

5. **Revenue & Billing**
   - Integrate Stripe billing with tiered plans, metered usage, invoicing, dunning workflows, and feature flag enforcement.

6. **Performance & Reliability**
   - Develop k6 load tests verifying p95 latency, throughput, and error budgets; document autoscaling and back-pressure mechanisms.

7. **Documentation & Exportability**
   - Enhance accessibility (WCAG 2.2 AA), tagged PDF exports with hash manifests, and interoperability exports for third-party verification.

8. **Infrastructure & Operations**
   - Deliver Terraform-based production stack covering networking, data stores, object storage, orchestration, blue-green deploys, backups, and DR drills.
   - Provide data residency configurations, BYO storage options, admin support tooling, and governance guardrails (CODEOWNERS, dependency policies).

## Delivery Approach

1. Sequence work according to the "Run Order" guidance: initialise the global context, execute Phase 1 orchestrator tasks, then extend via Phase 2 orchestrator.
2. Maintain tight feedback loops by running `pnpm -r build`, `docker compose up -d`, `pnpm -r test`, and `pnpm -w exec playwright test` after each major milestone.
3. Treat documentation and compliance artefacts as first-class deliverables, ensuring evidence collection aligns with ATO DSP OSF expectations.
4. Engage with external stakeholders (ATO onboarding, penetration testers, legal counsel) once code artefacts and playbooks are ready for review.

## Next Steps

1. Audit the current repository state against this roadmap to identify completed components versus gaps.
2. Prioritise scaffolding tasks that unblock automated testing and developer workflows.
3. Schedule compliance reviews (OSF, privacy, TFN) in parallel with live integration development to meet partner timelines.

