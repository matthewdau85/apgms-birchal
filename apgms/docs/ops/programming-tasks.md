# APGMS Phase 1 & Phase 2 Programming Task Breakdown

This backlog translates the "APGMS Phase 1 + Phase 2 Delivery Roadmap" into discrete programming tasks. Each task is scoped so that it can be scheduled, estimated, and executed by an individual feature team while keeping cross-cutting dependencies visible.

## How to Use This Document

- **Swimlanes** – Tasks are grouped by roadmap capability areas (e.g. Tooling, Service Layer, Security) and sequenced where dependencies exist.
- **Identifiers** – Use the suggested IDs when creating tickets in your planning tool to maintain traceability back to the roadmap.
- **Exit Criteria** – Each task includes a definition of done that should be met before closing the ticket.

---

## Phase 0 – Foundational Enablement

| ID | Task | Dependencies | Definition of Done |
| --- | --- | --- | --- |
| P0-01 | Inventory current repo, produce gap analysis against roadmap feature list. | None | Gap matrix stored in `/docs/status/roadmap-gap-analysis.md` with traffic-light status for each roadmap bullet. |
| P0-02 | Establish baseline CI commands (`pnpm -r build`, `pnpm -r test`, `pnpm -w exec playwright test`, `docker compose up -d`). | P0-01 | CI workflow or Makefile target executes commands locally; documentation added to `/docs/ops/runbook.md`. |
| P0-03 | Create project board swimlanes for Phase 1/2 epics referencing IDs herein. | P0-01 | Board URL documented in `/docs/ops/runbook.md`; all tasks entered with owners/placeholders. |

---

## Phase 1 Task Tree

### 1. Repository & Tooling

| ID | Task | Depends On | Definition of Done |
| --- | --- | --- | --- |
| P1-TL-01 | Align root to pnpm workspace conventions (package.json, `pnpm-workspace.yaml`, scripts). | P0-02 | Workspace builds succeed for all packages; lint/test scripts wired via pnpm. |
| P1-TL-02 | Add Poetry configuration for Python packages, including lockfile and virtualenv workflows. | P1-TL-01 | `poetry install` works for tax-engine and shared DTO libs; docs updated. |
| P1-TL-03 | Author Docker Compose stack (app services, Postgres, Redis, Mailhog, Prometheus, Grafana). | P1-TL-01 | `docker compose up -d` launches all containers; health-check docs captured. |
| P1-TL-04 | Configure GitHub Actions (build, unit tests, security scans, Playwright e2e). | P1-TL-01, P0-02 | Workflows run on PR, gate merges, and publish artifacts/logs. |

### 2. Service Layer

| ID | Task | Depends On | Definition of Done |
| --- | --- | --- | --- |
| P1-SV-01 | Scaffold API gateway (Node/TS) with routing, auth middleware, shared DTO import. | P1-TL-01 | Basic endpoints respond; lint/test coverage scaffolding in place. |
| P1-SV-02 | Scaffold Payments, Reconciliation, Audit, Worker services (Node/TS). | P1-SV-01 | Individual service repos with pnpm scripts, container definitions, and contract tests. |
| P1-SV-03 | Implement FastAPI tax engine with OpenAPI-first workflow and code generation for DTOs. | P1-TL-02 | OpenAPI spec published in `/docs/openapi/tax-engine.yaml`; generated clients consumed by gateway. |
| P1-SV-04 | Set up shared DTO package consumed by all services with versioned releases. | P1-SV-01 | DTO package published to internal registry; changelog maintained. |

### 3. Database Foundations

| ID | Task | Depends On | Definition of Done |
| --- | --- | --- | --- |
| P1-DB-01 | Design PostgreSQL schemas for orgs, tax, finance, reconciliation, audit tables. | P1-TL-03 | ERD documented; migrations committed. |
| P1-DB-02 | Implement row-level security policies and roles for multi-tenant isolation. | P1-DB-01 | RLS tests verifying tenant isolation in CI. |
| P1-DB-03 | Seed realistic organisations, registrations, lodgements for deterministic tests. | P1-DB-01 | Seed scripts executed via pnpm task; fixtures referenced in tests. |
| P1-DB-04 | Wire migrations/seeds into CI/CD pipelines. | P1-DB-03, P1-TL-04 | CI job runs migrations against ephemeral DB and seeds on demand. |

### 4. Security Baseline

| ID | Task | Depends On | Definition of Done |
| --- | --- | --- | --- |
| P1-SC-01 | Integrate JWT access/refresh token issuance and validation. | P1-SV-01 | Tokens minted via gateway; refresh rotation tests exist. |
| P1-SC-02 | Implement argon2id password storage and RBAC roles. | P1-SC-01 | Password flows covered by unit tests; role claims enforced on endpoints. |
| P1-SC-03 | Add CSRF protection, idempotency keys, and rate limiting middleware. | P1-SC-01 | Middleware enabled in gateway and admin portal; e2e tests cover duplicate submissions. |
| P1-SC-04 | Implement append-only audit logging service integration. | P1-SV-02 | Audit events captured with immutability guarantees documented. |
| P1-SC-05 | Map ASVS Level 2 controls in `/docs/security/asvs-level-2.md`. | P1-SC-01 | Document cross-references control to implementation evidence. |

### 5. Feature Highlights

| ID | Task | Depends On | Definition of Done |
| --- | --- | --- | --- |
| P1-FE-01 | Build admin ingestion portal for schedule uploads (PDF/CSV/JSON) with diff/dry-run. | P1-SV-01, P1-DB-03 | UI flow completed with tests; uploaded artefacts stored and diffed. |
| P1-FE-02 | Implement reconciliation import heuristics and exception queue. | P1-SV-02, P1-DB-02 | Scoring algorithm documented; audit events emitted for exceptions. |
| P1-FE-03 | Deliver payments mock services (PayTo/PayID simulators, ABA exports). | P1-SV-02 | Mock services respond to test flows; ABA export downloads validated. |
| P1-FE-04 | Implement GST/PAYGW calculators, BAS compilation, evidence token minting in tax engine. | P1-SV-03, P1-DB-03 | Calculator unit tests; BAS draft API returns expected payload; tokens auditable. |

### 6. Frontend Experience

| ID | Task | Depends On | Definition of Done |
| --- | --- | --- | --- |
| P1-UI-01 | Set up shadcn/ui design system with theming and accessibility linting. | P1-TL-01 | Component library documented; Storybook or equivalent running in CI. |
| P1-UI-02 | Build core pages (Dashboard, BAS, PAYGW, Reconciliation, Payments, TaxVault, Settings, Admin Ingestion, Help). | P1-UI-01, relevant backend APIs | Each page loads with mocked data; responsive behaviour verified. |
| P1-UI-03 | Implement six-step onboarding wizard integrated with backend endpoints. | P1-UI-02, P1-FE-04 | Wizard persists state; e2e covers onboarding to BAS draft. |

### 7. Operational Readiness

| ID | Task | Depends On | Definition of Done |
| --- | --- | --- | --- |
| P1-OP-01 | Add structured logging and tracing across services. | P1-SV-02 | Logs ship to central sink; trace IDs propagate via headers. |
| P1-OP-02 | Expose Prometheus metrics and ship starter Grafana dashboards. | P1-OP-01, P1-TL-03 | Metrics endpoints scraped; dashboards committed. |
| P1-OP-03 | Document privacy/retention controls and runbooks in `/docs/privacy` & `/docs/ops`. | P1-OP-01 | Policies linked to data flows; retention automation scripts defined. |
| P1-OP-04 | Produce quickstart, architecture, runbooks, OpenAPI bundle docs. | P1-SV-03 | Docs accessible in repo; build generates OpenAPI bundle artifacts. |

### 8. Testing

| ID | Task | Depends On | Definition of Done |
| --- | --- | --- | --- |
| P1-QA-01 | Establish unit and contract test suites with ≥85% coverage thresholds. | Relevant feature tasks | Coverage reports stored in CI; gating enforced. |
| P1-QA-02 | Implement Playwright e2e covering onboarding → BAS draft → reconciliation → payment debit → RPT token. | P1-UI-03, P1-FE-02, P1-FE-03 | Pipeline runs e2e nightly; failures block release. |

---

## Phase 2 Task Tree

### 1. ATO Integrations

| ID | Task | Depends On | Definition of Done |
| --- | --- | --- | --- |
| P2-ATO-01 | Build `/services/sbr` service with MTLS, message signing, certificate admin UI. | P1-SV-01, P1-SC-02 | End-to-end BAS/STP submission to sandbox; certificate rotation documented. |
| P2-ATO-02 | Persist receipts, correlation IDs, redact payload archives. | P2-ATO-01, P1-DB-02 | Data stored with retention policies; redaction verified in tests. |

### 2. Compliance & Governance

| ID | Task | Depends On | Definition of Done |
| --- | --- | --- | --- |
| P2-CG-01 | Expand `/docs/dsp-osf` with secure SDLC, change control, vuln management, personnel matrices, incident response. | P1-OP-03 | Documents versioned; evidence links available. |
| P2-CG-02 | Add CI gates: CycloneDX SBOM, Trivy scans, signed commit enforcement. | P1-TL-04 | CI fails without signed commits; SBOM stored as artifact. |

### 3. External Connectivity

| ID | Task | Depends On | Definition of Done |
| --- | --- | --- | --- |
| P2-EC-01 | Build registries service for ABN/GST/PAYGW lookups with consent logging. | P1-SV-01, P1-DB-02 | Service exposes search API; consent logs persisted and auditable. |
| P2-EC-02 | Implement accounting connectors (Xero/MYOB/QBO) with OAuth, sync policies, UI controls. | P2-EC-01, P1-UI-02 | OAuth flows tested; sync policies configurable via UI. |
| P2-EC-03 | Deliver live PayTo/PayID adapter with webhook HMAC rotation, velocity rules, PCI scope docs. | P1-FE-03 | Adapter integrated with payments service; security docs updated. |
| P2-EC-04 | Provide CDR-based bank feed ingestion with consent UX and reconciliation pipeline integration. | P1-FE-02, P2-EC-02 | CDR connector passes compliance checks; data feeds drive reconciliation scoring. |

### 4. Security Enhancements

| ID | Task | Depends On | Definition of Done |
| --- | --- | --- | --- |
| P2-SC-01 | Implement envelope encryption with KMS-backed key rotation CLI and audit trails. | P1-SC-02, P1-DB-02 | Encryption enforced for TFN and sensitive fields; rotation playbook tested. |
| P2-SC-02 | Produce STRIDE threat models, DFDs, DPIA, and incident response playbooks. | P1-OP-03 | Models stored in `/docs/security/threat-models`; sign-off recorded. |

### 5. Revenue & Billing

| ID | Task | Depends On | Definition of Done |
| --- | --- | --- | --- |
| P2-RB-01 | Integrate Stripe billing with tiered plans and metered usage. | P1-SV-02 | Stripe sandbox accounts provisioned; usage events emitted. |
| P2-RB-02 | Implement invoicing, dunning workflows, and feature flag enforcement. | P2-RB-01 | Overdue accounts trigger dunning emails; feature flags toggle access. |

### 6. Performance & Reliability

| ID | Task | Depends On | Definition of Done |
| --- | --- | --- | --- |
| P2-PR-01 | Develop k6 load tests covering critical flows, capture p95 latency/throughput/error budgets. | P1-QA-02 | k6 scripts in repo; CI publishes performance dashboards. |
| P2-PR-02 | Document autoscaling/back-pressure mechanisms and embed alerts. | P2-PR-01, P1-OP-02 | Runbooks outline SLOs; alerting thresholds configured. |

### 7. Documentation & Exportability

| ID | Task | Depends On | Definition of Done |
| --- | --- | --- | --- |
| P2-DX-01 | Achieve WCAG 2.2 AA across frontend, update accessibility docs. | P1-UI-02 | Accessibility audits passing; documentation updated in `/docs/accessibility`. |
| P2-DX-02 | Generate tagged PDF exports with hash manifests for third-party verification. | P1-FE-01, P1-FE-04 | Export pipeline produces hashed bundles; verification instructions documented. |
| P2-DX-03 | Implement interoperability exports for third-party ingestion. | P2-DX-02 | APIs documented with schema files; integration tests exist. |

### 8. Infrastructure & Operations

| ID | Task | Depends On | Definition of Done |
| --- | --- | --- | --- |
| P2-IO-01 | Deliver Terraform-based production stack (networking, data stores, object storage, orchestration). | P1-TL-03 | Terraform plans validated; environments provisioned in sandbox. |
| P2-IO-02 | Implement blue-green deploys, backups, DR drills, and data residency options. | P2-IO-01 | Runbook documents switchover steps; DR test evidence stored. |
| P2-IO-03 | Add governance guardrails (CODEOWNERS, dependency policies, admin tooling). | P1-OP-01 | Policies enforced in CI; admin tooling accessible to support team. |

---

## Cross-Cutting Practices

1. **Evidence Collection** – Attach implementation evidence (screenshots, logs, docs) to each task before closure to satisfy DSP OSF expectations.
2. **Feedback Loop** – After completing any epic, run the mandated command suite (`pnpm -r build`, `docker compose up -d`, `pnpm -r test`, `pnpm -w exec playwright test`) and capture results in the ticket.
3. **Stakeholder Reviews** – Schedule compliance, legal, and penetration testing reviews once Phase 1 epics reach 80% completion to avoid downstream delays.

---

## Next Actions

1. Execute Phase 0 tasks to establish baseline visibility and tooling.
2. Use this backlog to populate the delivery board, assigning owners and sprint targets.
3. Revisit and refine task definitions after each milestone retrospective to incorporate lessons learned.
