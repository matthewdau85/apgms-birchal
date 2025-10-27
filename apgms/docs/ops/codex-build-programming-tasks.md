# APGMS Codex Build Programming Tasks

This backlog translates the [Codex Build Playbook](./codex-build-playbook.md) into discrete programming tasks. The tasks are grouped by domain, include explicit success criteria, and flag prerequisite dependencies. Use this document when planning delivery increments or preparing prompts for code generation tools.

## Repo and Developer Experience
- **Bootstrap repository scaffolding**  
  _Dependencies_: none  
  _Success_: Root configs (`.editorconfig`, `.gitignore`, `.gitattributes`, `LICENSE`, `SECURITY.md`, `CODEOWNERS`, `README`, `CONTRIBUTING`) match standards and reference APGMS-specific workflows.
- **Author CI workflows**  
  _Success_: `.github/workflows/ci.yml`, `e2e.yml`, and `security.yml` execute linting, typing, unit/build, Playwright, Trivy, npm audit, Bandit, CycloneDX SBOM generation and verification.
- **Container orchestration**  
  _Success_: `docker-compose.yml` provisions Postgres, Redis, Mailhog, Grafana/Prometheus, API gateway, tax-engine, payments, recon, audit, webapp, worker services with shared networks and env defaults.
- **Developer scripts**  
  _Success_: Shell and PowerShell scripts for dev-up, db-reset, seed, e2e-run, k6-load, key-rotate, export-dump; cross-platform compatibility.
- **Environment generation**  
  _Success_: `/infra/dev/.env.example` and generator scripts produce deterministic env files for local use.

## Database Layer
- **Design Postgres schemas** covering auth, tax, gst, paygw, finance, recon, audit, admin.  
  _Success_: Schema DDL meets constraints (RLS policies, encryption markers) and references integer-cent currency.  
- **Implement migrations**  
  _Dependencies_: Schema design  
  _Success_: Migration scripts created per schema with idempotent operations and envelope-encrypted columns.
- **Create seeders**  
  _Success_: Seeds insert two orgs, three users per org, GST/PAYGW data, 25 bank lines, anomalies, and encrypted secrets.

## Core Services
- **API Gateway service**  
  _Success_: Fastify/Express API with OpenAPI-first workflow, zod validators, JWT auth (access/refresh), RBAC, CSRF protection, rate limiting, structured logging.
- **Payments service**  
  _Success_: Implement `IPaymentRail` interface, mocks for PayTo, PayID, ABA exporter, webhook simulator, mandate lifecycle, idempotent debit handling.
- **Reconciliation service**  
  _Success_: Parsers for OFX/QIF/CSV, matching heuristics (Levenshtein), scoring thresholds, exception flows emitting audit events.
- **Audit service**  
  _Success_: Append-only log, before/after digests, RPT mint/verify/revoke APIs, redaction pipeline with deterministic hashes.
- **Tax engine (FastAPI)**  
  _Success_: Endpoints `/gst/calc`, `/paygw/calc`, `/bas/compile`, rule JSON versions, anomaly hook stub, tests validating calculations.
- **Registries adapters**  
  _Success_: ABR/ATO checks with caching/backoff/consent logging using fixtures.
- **SBR adapters**  
  _Success_: BAS lodge/amend & STP Phase 2 flows with MTLS client, message signing, response archiving, redacted logs.
- **Connector adapters**  
  _Success_: Xero/MYOB/QBO OAuth flows, refresh tokens, webhook handling, sync jobs, conflict policies.
- **Worker service**  
  _Success_: Queue definitions (ingestion, recon, billing, exports, key rotation), job processors, observability hooks.
- **Optional CDR module**  
  _Success_: Read-only Open Banking ingestion into reconciliation schema with consent storage and scheduling.

## Web Application
- **Shell and layout**  
  _Success_: Sidebar, topbar (org switcher, search, help, profile), breadcrumbs, notifications, theming, focus management, i18n scaffold.
- **Dashboard & Modules**  
  _Success_: Implement dashboards, BAS workspace (GST/PAYGW/Adjustments/Summary/Evidence tray/Lock-Amend/PDF), PAYGW module, Reconciliation Center, Payments views, Evidence & Audit, Settings, Admin Schedules Ingestion, Help center.
- **Onboarding wizard**  
  _Success_: Six-step wizard with live registry checks, mock bank mandate, accounting/BAS cycle selection, user roles, review with RPT minting.
- **Accessibility compliance**  
  _Success_: WCAG 2.2 AA patterns, error summaries, live regions, reduced motion, tagged PDF exports.

## Evidence & Exports
- **Evidence uploader & RPT flows**  
  _Success_: Upload mapped to periods, verify/mint flows, hash chaining.
- **Canonical exports**  
  _Success_: JSON/CSV exports for BAS drafts, recon results, audit logs; SHA-256 manifest surfaced in UI.

## Billing & Pricing
- **Stripe integration**  
  _Success_: Plans (Starter/Growth/Pro), seat counts, metered events, Aussie tax invoices, dunning and grace logic, feature locks, customer portal, Settings UI.

## Observability & Security
- **Structured logging & metrics**  
  _Success_: pino/structlog, request IDs, `/metrics`, traces, Grafana dashboards-as-code, Prometheus config.
- **SLO tooling**  
  _Success_: k6 scripts for BAS compile, recon match, debit flows hitting p95<250ms and RPS goals.
- **Security controls**  
  _Success_: Argon2id passwords, JWT rotation, least-privileged DB, RLS, rate limiting, validation, envelope crypto, rotation jobs, threat model docs.

## Governance & Docs
- **Docs structure**  
  _Success_: Populate `/docs` with quickstart, architecture, security mapping, tax rules, ops runbooks, accessibility report, OpenAPI bundles, billing overview, ToS/Privacy stubs.
- **DSP OSF documentation**  
  _Success_: Author SDLC, change control, code review SOP, dependency management, pen-test readiness, monitoring/logging SOP, evidence index, PCI scope.
- **IP safeguards & policy docs**  
  _Success_: Create `/docs/ip` contents, public messaging guardrails, workflow instructions.
- **Governance assets**  
  _Success_: Supply-chain checklists, signed commit policies, dependency bot configuration.

## Infrastructure & Deployment
- **IaC modules**  
  _Success_: Terraform/CDK for VPC, RDS, Redis, object storage, ECS/Fargate (or Fly.io), ALB, TLS, blue-green deploys, rollbacks, backups, DR, SSM secrets, dashboards-as-code.
- **Data residency tooling**  
  _Success_: Org policy enforcement, BYO S3 hooks, export/delete tooling, processor agreement template.

## Testing & Automation
- **Unit and contract test suites**  
  _Success_: Coverage ≥85% across services.
- **Playwright e2e suite**  
  _Success_: Workflow coverage onboarding → BAS draft → recon match → debit → RPT mint, a11y checks, PDF tags, SBR/STP fixture validations.
- **Load testing automation**  
  _Success_: Scripts in `scripts/k6-load.*`, results trending, SLO enforcement.
- **GitHub Actions integration**  
  _Success_: CI wires lint/typecheck/unit/build, e2e, security, SBOM workflows.

## Add-On Modules
- **Risk register & KRIs**  
  _Success_: `/docs/risk/register.md`, `/docs/risk/kri-dash.md` with PromQL/k6 probes, linked dashboards JSON.
- **Status page**  
  _Success_: `/status` static site, build script, JSON endpoints fed by worker synthetic checks, incident templates and automation.
- **Data classification enforcement**  
  _Success_: Policy doc, lint rules blocking logging of restricted fields, DB decorators tagging sensitive columns, redaction utilities with tests.
- **Privacy-safe analytics**  
  _Success_: Server-side metrics module, settings toggles, telemetry documentation.
- **Customer success playbooks**  
  _Success_: Playbooks doc and email templates.
- **Vulnerability disclosure program**  
  _Success_: `/.well-known/security.txt`, VDP doc, intake workflow into worker queue, admin “Report” viewer.
- **Sub-processor register & UI**  
  _Success_: Doc and Settings ▸ Legal page with change history from git.
- **Tax agent boundary messaging**  
  _Success_: Disclaimers on BAS, PAYGW, Help pages; CTA to connect agent; explainer modal.
- **Patent hygiene workflow**  
  _Success_: `/docs/ip/workflow.md`, CI check preventing INTERNAL comments in published bundles, design note script.
- **Data migration & exit**  
  _Success_: Export packs (JSON/CSV + manifest), verified delete with tombstones, e2e tests, `/docs/ops/exit.md` procedures.

## Runbook Alignment
- **README runbook commands**  
  _Success_: Ensure README documents `pnpm i`, `pnpm -r build`, `docker compose up -d`, `pnpm -r test`, `pnpm -w exec playwright test`, `scripts/k6-load.*`, and Terraform commands (`init/plan/apply`).

Use this breakdown to plan sprints, prioritize dependencies, and feed prompts into automation workflows. Track completion in the ops runbook as features reach “definition of done.”
