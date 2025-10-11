# APGMS "Everything Orchestrator"

The following architect prompt merges the previously separate Phase 1 and Phase 2 scopes into a single run for generating the full APGMS monorepo. Use it when you need a single instruction set that captures the entire build context, architecture, compliance, and delivery requirements for the Automated PAYGW & GST Management System.

> Paste this prompt into your preferred architecture/code-generation copilot to scaffold a complete repository, including services, infrastructure, docs, and test automation. The output should include runnable Docker assets and end-to-end coverage described in the brief.

```
You are my lead architect for APGMS (Automated PAYGW & GST Management System), an Australian tax-compliance app for micro/small businesses. Deliver a production-grade monorepo that boots locally with Docker and passes e2e tests on first run.

Core mandates
- Stack: Monorepo; Node/TypeScript microservices; Python/FastAPI tax-engine (+ basic anomaly hooks); React + Vite + Tailwind + shadcn/ui; Postgres; Redis; Docker Compose; GitHub Actions CI; Playwright e2e; OpenAPI-first; pnpm; Poetry.
- Time/money: Australia/Brisbane; ISO-8601; amounts in cents (integers); deterministic audit hashes.
- Security/A11y: OWASP ASVS L2 baseline; WCAG 2.2 AA; RBAC; RLS; idempotency; structured logging; Prometheus metrics; basic OpenTelemetry traces; privacy/retention controls.
- Compliance scope: DSP OSF evidence pack; SBR BAS lodge/amend; STP Phase 2; TFN Rule compliance; NDB-ready IR plan; Accessibility (tagged PDFs); canonical exports + hash manifests.
- Product domains: orgs/users/authz; ABN & registrations; onboarding wizard; one-way tax wallets; payments (PayTo/PayID mocks + real adapter slot + ABA export); reconciliation (OFX/QIF/CSV + CDR optional); GST & PAYG(W) calculators; BAS compile/lodge; append-only audit + RPT (evidence tokens); Admin ingestion portal for ATO schedules; Settings; Help.

Acceptance rule
- Reply with the complete file tree then file contents (chunk if needed).
- Code must: (1) build, (2) run via Docker, (3) seed meaningful demo data, (4) pass unit/contract/e2e, (5) include docs/runbooks/IaC.
- Avoid TODOs/placeholders; when external services aren’t live, provide deterministic mocks behind adapters and conformance fixtures.

Deliverables (ALL)
1) Repo & Dev UX
   - Root configs: .editorconfig, .gitattributes, .gitignore, LICENSE (MIT), SECURITY.md, CODEOWNERS, README (10-min quickstart), CONTRIBUTING.
   - .github/workflows: ci.yml (lint/typecheck/unit/build), e2e.yml (docker up + Playwright), security.yml (Trivy scan, npm audit, Bandit, CycloneDX SBOM + sbom-verify).
   - docker-compose.yml for: postgres, redis, mailhog, grafana+prom, api-gateway, tax-engine, payments, recon, audit, webapp, worker.
   - scripts/: dev-up.ps1/.sh; db-reset; seed; e2e-run; k6-load; key-rotate; export-dump.
   - /infra/dev/.env.example and script to autogenerate .env (Windows-safe).

2) Database (single Postgres with schemas)
   - auth: users, orgs, memberships, api_keys
   - tax: registrations, periods (open/locked/lodged/amended), schedules_meta
   - gst: supplies, purchases, adjustments, bas_calcs
   - paygw: employees (TFN masked), pay_events, withholding_calcs
   - finance: accounts, mandates, payments, payment_events, idempotency_keys
   - recon: bank_imports, bank_txns, matches, exceptions
   - audit: audit_events (hash-chained), rpts (Reconciliation Pass Tokens)
   - admin: ingestion_jobs, documents
   - Crypto: DEK per table where sensitive (TFN/bank); envelope encryption abstraction.
   - Migrations via Prisma/Knex (Node) + Alembic (Python if needed). Seeders with 2 orgs, 3 users each, demo tax data, 25 bank lines, anomaly spike.

3) Services (TypeScript unless noted)
   - /services/api-gateway: Fastify/Express, OpenAPI router, zod schemas, JWT auth (access/refresh), RBAC (OWNER/ADMIN/STAFF/ACCOUNTANT), CSRF on forms.
   - /services/payments: IPaymentRail abstraction; PayToMock/PayIDMock; real-adapter slot; ABA exporter; signed webhook simulator; mandate lifecycle; idempotent debit endpoint.
   - /services/recon: parsers (OFX/QIF/CSV), matching heuristics (amount/date/ref similarity/Levenshtein), scoring, exceptions actions; emits audit.
   - /services/audit: append-only log with before/after digests, RPT mint/verify/revoke, redaction pipeline.
   - /services/tax-engine (Python/FastAPI): endpoints /gst/calc, /paygw/calc, /bas/compile; rules loader from versioned JSON (gst_rates_<year>.json, gst_adjustments.json, paygw_schedules_<year>.json); anomaly rules stub.
   - /services/registries: ABR/ATO registration checks (with caching, backoff, consent logs) behind adapter interfaces; sandbox fixture.
   - /services/sbr: SOAP/MTOM or SDK client with MTLS, message signing, env toggles (test/prod); BAS lodge/amend; STP Phase 2 submit/ack; response archiving; receipt numbers; redacted logs.
   - /services/connectors: Xero/MYOB/QBO adapters (OAuth, refresh, webhooks, sync jobs; conflict policy hooks).
   - /services/cdr (optional): Open Banking read flows, consent storage, scheduled pulls -> recon.bank_txns.
   - /worker: queues for ingestion, recon batch, billing metering, exports, key rotation.

4) Web app (React + Vite + Tailwind + shadcn/ui + Framer Motion)
   - Shell: Sidebar, Topbar (org switcher/search/help/profile), breadcrumbs, notifications, theme (dark/light), focus management, i18n scaffold (AU English default).
   - Pages: Dashboard; BAS Workspace (GST/PAYGW/Adjustments/Summary + Evidence tray + Lock/Amend/PDF); PAYGW module (employees/pay events/what-if calculator); Reconciliation Center (triage queues, detail drawer, keyboard shortcuts); Payments (Mandates/Debits/ABA export); Evidence & Audit (TaxVault with RPT viewer + chain visualization); Settings (Org/Users/Tax/Integrations/Accessibility/Retention); Admin ▸ Schedules Ingestion (upload PDF/CSV/JSON → parse → diff → dry run → apply); Help (checklists, “explain this number”, support stubs).
   - Onboarding wizard (6 steps): Business basics → Registrations check (live via /registries) → Bank mandate (PayTo mock; ABA alt) → Accounting method & BAS cycle → Users & roles → Review & Confirm (mints initial RPT; seeds period).
   - Accessibility: WCAG 2.2 AA patterns; error summaries; live regions; reduced motion; all PDFs exported with tags; PAC-check in tests.

5) Payments, Reconciliation, Evidence
   - Payment state machine (created→pending_capture→settled|failed→reconciled), velocity caps, 3-strike pause; replay-safe webhooks; audit on all transitions.
   - Recon scoring thresholds: auto-match ≥0.9; review 0.6–0.9; unmatched <0.6; batch actions; timeline with audit links.
   - Evidence: drag/drop docs mapped to period/label; RPT mint/verify flows; canonical export JSON/CSV + SHA-256 manifest.

6) Admin Ingestion Portal (ATO schedules & docs)
   - Uploaders (50MB, streaming parse, virus-scan stub), table extract → paygw_schedules_<year>.json & gst_adjustments.json; versioning via tax.schedules_meta; diff viewer; dry-run impact list; OWNER/ADMIN only; all audited.

7) Billing (Stripe)
   - Plans Starter/Growth/Pro; seats; metered events (reconciles, lodgements); Aussie tax invoices with ABN and GST; dunning; grace window; feature lock rules; customer portal; Settings UI.

8) Observability & SLOs
   - pino/structlog logging with request IDs; metrics endpoints; basic traces; starter Grafana dashboards as code.
   - SLOs: API p95 < 250ms; 500 RPS sustained; monthly error budget <0.1%. k6 scenarios for BAS compile, recon match, debit path; back-pressure via queues.

9) Security & Keys
   - Argon2id; JWT rotation; least-priv DB users per service; RLS; rate limiting; input validation everywhere.
   - Envelope encryption: KMS master + DEKs per sensitive table; quarterly rotation job + CLI; audited (redacted).
   - Threat model: STRIDE + DFDs per service; DPIA/PIA for TFN/bank data; Incident Response playbooks (OAIC/ATO timelines); quarterly tabletop checklist.

10) Governance & Supply-chain
   - Signed commits, branch protections; dependency bot weekly PRs; Trivy and sbom-verify as required checks; CycloneDX SBOM attached to releases; supplier risk checklist.

11) Docs & Contracts
   - /docs/: architecture (C4 + sequences); security (ASVS mapping; TFN SOP; crypto; IR); tax-engine (rules format); ops-runbook (backups/restore/keys rotation); accessibility report; API OpenAPI bundles; billing/ToS/Privacy policy stubs.
   - /docs/dsp-osf/: Secure SDLC; change control; code review SOP; dependency mgmt; pen-test readiness; monitoring/logging SOP; evidence index linking CI artifacts & logs; PCI DSS scope note (Stripe hosted).
   - /docs/ip/: public messaging guardrails (don’t disclose INTERNAL algorithms); claim theme notes.

12) IaC & Deploy
   - Terraform (or CDK) modules for VPC, RDS (PITR), Redis, object storage (evidence), container orchestrator (ECS/Fargate or Fly.io), ALB, TLS, blue-green, rollbacks; backups; DR drill script; secrets via SSM; dashboards as code.
   - Data residency: org policy with region pinning, optional BYO S3; export/delete tooling; processor agreement template.

13) Tests & CI
   - Unit/contract tests across services; coverage ≥85%.
   - Playwright e2e: onboarding → BAS draft → recon match → debit → RPT mint; a11y checks; PDF tag check; SBR/STP fixture runs with receipts archived.
   - k6 load tests hit SLOs locally.
   - GitHub Actions wired to run lint/typecheck/unit/build/e2e/security/SBOM.

14) Run commands (documented in README)
   - pnpm i
   - pnpm -r build
   - docker compose up -d
   - pnpm -r test
   - pnpm -w exec playwright test
   - scripts/k6-load.sh (or .ps1)
   - terraform init/plan/apply for minimal prod profile (no secrets committed)

Output: Provide file tree then files, ensuring all the above exists and runs exactly as specified.
```

## Scope confirmation

- **Yes for build scope**: this unified prompt covers the entire product build, including UI, tax logic, audit/RPT, payments/reconciliation, admin ingestion, accessibility, observability, billing, DSP OSF evidence, SBR/STP flows (fixtures), ABR checks, accounting connectors, optional CDR, key rotation, IaC, governance, and documentation assets.
- **External steps still required**: ATO onboarding (test/prod credentials & whitelisting), external penetration testing, and final legal review of Privacy/Terms/billing copy.

## Additional recommendations

The following initiatives remain outside the core build scope but are recommended for a production launch:

1. Formal risk register & KRIs with ownership and review cadence.
2. SLA/support policy, including response times, incident communications, and status page operations.
3. Data classification policy mapping TFN/bank details to a “restricted” tier with handling rules.
4. Key person continuity planning, including credential escrow and audited “break glass” access.
5. Insurance coverage: cyber liability, tech E&O, and potential tax workflow endorsements.
6. Export controls & sanctions checks for any future non-AU usage.
7. Privacy-safe analytics approach (server-side metrics, no PII in telemetry).
8. Content design playbooks with plain-English BAS/PAYGW explainers.
9. Customer success playbooks for onboarding, retention signals, and churn mitigation.
10. Manual accessibility audits (including PDF tagging verification) scheduled periodically.
11. Business continuity drills covering backups and region failover with logged outcomes.
12. Pricing experiments infrastructure for metered features, promotions, and trials.
13. Vulnerability disclosure program (security.txt, intake process) aligned with incident response.
14. Third-party processor register and customer notification workflow.
15. Tax agent boundary guidance to avoid offering unlicensed advice.
16. Patent filing hygiene with dated internal notes ahead of public disclosures.
17. Data migration & exit tooling for customer exports and account deletion.

Use or adapt this orchestrator prompt whenever you need to spin up the full APGMS environment from scratch.
