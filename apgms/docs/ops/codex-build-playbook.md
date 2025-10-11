# APGMS Codex Build Playbook

This document captures the prompt-driven workflow for generating the APGMS monorepo from scratch using Codex or a similar code copilot. It consolidates the global context, orchestrator instructions, optional modules, and the iterative build plan supplied by the product lead.

## Global Context
```
You are my lead engineer for APGMS (Automated PAYGW & GST Management System), an Australian tax-compliance app for micro/small businesses.

Constraints & standards:
- Monorepo; Node/TypeScript microservices; Python/FastAPI tax-engine (+ optional anomaly hooks); React + Vite + Tailwind + shadcn/ui + Framer Motion; Postgres; Redis; Docker Compose; GitHub Actions; Playwright e2e; OpenAPI-first.
- AU/Brisbane timezone; ISO-8601; money in cents (integers); deterministic audit hashes.
- Security: OWASP ASVS L2 baseline, JWT+RBAC, Row-Level Security, idempotency, rate limiting, structured logging, Prometheus metrics, basic traces.
- Accessibility: WCAG 2.2 AA across UI and tagged PDFs.
- Compliance-by-design in-repo: DSP OSF evidence docs, TFN Rule controls, NDB IR runbooks, SBR/STP adapters with fixtures, ABR/ATO checks, canonical exports with SHA-256 manifests.
- Delivery rule: Output runnable code & files only (no placeholders). Must pass `pnpm -r build`, start with Docker, seed demo data, and pass unit/contract/e2e tests. Use deterministic mocks behind adapters where live creds aren’t present.
```

## Everything Orchestrator (Dev-Only)
```
Generate a complete monorepo that builds, runs via Docker, seeds data, and passes unit/contract/e2e tests.

Deliverables
1) Repo & Dev UX
- Root: .editorconfig, .gitattributes, .gitignore, LICENSE (MIT), SECURITY.md, CODEOWNERS, README (10-min quickstart incl. Windows), CONTRIBUTING.
- .github/workflows: ci.yml (lint/typecheck/unit/build), e2e.yml (docker up + Playwright), security.yml (Trivy, npm audit, Bandit, CycloneDX SBOM + sbom-verify).
- docker-compose.yml: postgres, redis, mailhog, grafana+prom, api-gateway, tax-engine, payments, recon, audit, webapp, worker.
- scripts/: dev-up.ps1/.sh, db-reset, seed, e2e-run, k6-load, key-rotate, export-dump.
- /infra/dev/.env.example + generator script (.ps1 and .sh).

2) Database (single Postgres, multiple schemas) + migrations + seeders
- auth (users, orgs, memberships, api_keys)
- tax (registrations, periods, schedules_meta)
- gst (supplies, purchases, adjustments, bas_calcs)
- paygw (employees with TFN masking rules, pay_events, withholding_calcs)
- finance (accounts, mandates, payments, payment_events, idempotency_keys)
- recon (bank_imports, bank_txns, matches, exceptions)
- audit (audit_events hash-chained, rpts tokens)
- admin (ingestion_jobs, documents)
- Crypto: envelope encryption abstraction (KMS master simulated + DEKs). Seed: 2 orgs, 3 users each, realistic GST/PAYGW data, 25 bank lines, anomalies.

3) Services
- api-gateway (Fastify/Express, OpenAPI, zod validators, JWT access/refresh, RBAC OWNER/ADMIN/STAFF/ACCOUNTANT, CSRF).
- payments (IPaymentRail; PayToMock, PayIDMock, ABA exporter; signed webhook simulator; mandate lifecycle; idempotent debit).
- recon (OFX/QIF/CSV parsers; matching heuristics + Levenshtein; scoring thresholds; exception actions; emits audit).
- audit (append-only event log with before/after digests; RPT mint/verify/revoke; redaction pipeline).
- tax-engine (Python/FastAPI): /gst/calc, /paygw/calc, /bas/compile; versioned JSON rules: gst_rates_<year>.json, gst_adjustments.json, paygw_schedules_<year>.json; anomaly stub.
- registries: ABR/ATO registration checks behind adapter; caching/backoff/consent logs; sandbox fixtures.
- sbr: BAS lodge/amend + STP Phase 2 submit/ack; MTLS client & message signing; env toggle (test/prod); response archiving; receipt numbers; redacted logs; conformance fixtures.
- connectors: Xero/MYOB/QBO adapters (OAuth, refresh, webhooks), sync jobs, conflict policy hooks.
- cdr (optional): Open Banking read-only feeds; consent storage; scheduled pulls to recon.bank_txns.
- worker: queues (ingestion, recon batches, billing metering, exports, key rotation).

4) Web App (React)
- Shell: Sidebar, Topbar (org switcher/search/help/profile), breadcrumbs, notifications, theme (dark/light), focus mgmt, i18n scaffold (AU English).
- Pages: Dashboard; BAS Workspace (GST/PAYGW/Adjustments/Summary + Evidence tray + Lock/Amend/PDF); PAYGW module; Reconciliation Center; Payments (Mandates/Debits/ABA export); Evidence & Audit (TaxVault + RPT viewer/chain viz); Settings (Org/Users/Tax/Integrations/Accessibility/Retention); Admin ▸ Schedules Ingestion; Help (checklists + “explain this number”).
- Onboarding wizard (6 steps): Business → Registrations check (live via registries) → Bank mandate (mock PayTo; ABA option) → Accounting method & BAS cycle → Users & roles → Review & Confirm (mint initial RPT; seed period).
- Accessibility: WCAG 2.2 AA patterns incl. error summaries, live regions, reduced motion; exported PDFs tagged.

5) Admin Ingestion Portal
- Upload PDF/CSV/JSON (streaming parse, size ≤50MB), table extract → normalized rules JSON; versioning (tax.schedules_meta); diff viewer; dry-run impact; OWNER/ADMIN only; full audit.

6) Evidence, Exports & Hashes
- Evidence uploader mapped to period/label; RPT mint/verify flows.
- Canonical JSON/CSV exports for BAS drafts, recon results, audit logs; SHA-256 manifest (display in Evidence tray).

7) Billing (Stripe)
- Starter/Growth/Pro, seats + metered events (reconciles, lodgements); Aussie tax invoices (ABN/GST); dunning, grace, feature locks; customer portal; Settings UI.

8) Observability & SLOs
- pino/structlog logs with request IDs; /metrics endpoints; basic traces; Grafana dashboards-as-code.
- SLOs: API p95<250ms, 500 RPS sustained, error budget <0.1%/mo. k6 scripts for BAS compile, recon match, debit; queue back-pressure.

9) Security & Keys
- Argon2id; JWT rotation; least-priv DB users; RLS; rate limiting; input validation.
- Envelope crypto (KMS master abstraction + DEKs per sensitive table); quarterly rotation job + CLI; audited with redaction.
- Threat model (STRIDE) + DFDs; DPIA/PIA; NDB IR playbooks (OAIC/ATO timelines); quarterly tabletop checklist.

10) Governance & Supply-Chain (in-repo, code-focused)
- Signed commits, branch protections; dependency bot weekly PRs; Trivy and sbom-verify as required checks; CycloneDX SBOM on releases; supplier risk checklist markdown.

11) Docs
- /docs: README quickstart; architecture (C4 + sequences); security (ASVS mapping; TFN SOP; crypto; IR); tax-engine rules; ops-runbook (backups/restore/key-rotation); accessibility report; OpenAPI bundles; billing overview; ToS/Privacy *stubs* (non-legal).
- /docs/dsp-osf: Secure SDLC, change control, code review SOP, dependency mgmt, pen-test readiness, monitoring/logging SOP, evidence index, PCI DSS scope note.
- /docs/ip: public messaging guardrails (don’t disclose INTERNAL algorithms); claim theme notes.

12) IaC & Deploy
- Terraform/CDK modules: VPC, RDS(Postgres PITR), Redis, object storage for evidence, ECS/Fargate (or Fly.io), ALB, TLS, blue-green, rollbacks; backups; DR drill script; secrets via SSM; dashboards-as-code.
- Data residency: org policy (region pinning, optional BYO S3); export/delete tooling; processor agreement template (non-legal).

13) Tests & CI
- Unit/contract tests (coverage ≥85%).
- Playwright e2e: onboarding → BAS draft → recon match → debit → RPT mint; a11y checks; PDF tag check; SBR/STP fixture run stores receipts.
- k6 load hits SLOs locally.
- Actions wired to run lint/typecheck/unit/build/e2e/security/SBOM.

Runbook (README must include)
- pnpm i
- pnpm -r build
- docker compose up -d
- pnpm -r test
- pnpm -w exec playwright test
- scripts/k6-load.(ps1|sh)
- terraform init/plan/apply (minimal prod profile; no secrets in repo)
```

## Add-On Module Prompts
```
Risk Register & KRIs (repo-managed)
Create /docs/risk/register.md with a table (ID, Category, Description, KRI, Owner, Mitigation, Review cadence, Status). Add /docs/risk/kri-dash.md that describes PromQL/K6 probes for availability, error budget, debit failures, recon backlog, anomaly rate. Link dashboards-as-code JSON.

Status Page (code + docs)
Add a minimal status site in /status (static), with build script, JSON endpoints fed by synthetic checks from worker. Include incident templates in /docs/ops/incident-templates.md and automation to publish updates to /status/out.

Data Classification Policy (enforced in code)
Create /docs/security/data-classification.md (public/internal/confidential/restricted). Add ESLint comments and DB decorators tagging restricted columns (TFN, bank). Add a lint rule that blocks logging of restricted fields; add redaction utility and tests.

Privacy-safe Analytics
Implement a server-side metrics module (no PII). Add toggles in Settings ▸ Privacy. Document exactly what is collected in /docs/privacy/telemetry.md. No client beacons.

Customer Success Playbooks (repo docs + email templates)
Add /docs/success/playbooks.md (onboarding, check-ins, churn signals). Create /docs/success/email-templates/*.md for welcome, mandate reminder, recon assistance, BAS due soon, failed debit recovery.

Vulnerability Disclosure Program
Add /.well-known/security.txt and /docs/security/vdp.md with scope, safe harbor, contact. Wire an intake email/env var; route into worker queue; add an admin-only “Report” viewer with redactions.

Sub-processor Register
Add /docs/legal/subprocessors.md listing infrastructure, billing, logging providers. Build a simple Settings ▸ Legal page to display this doc and a “change history” sourced from git.

Tax Agent Boundary Messaging (UI)
Insert non-advice disclaimers in BAS, PAYGW, and Help pages. Add a “Connect a Registered Tax Agent” CTA (configurable link) and a “When to talk to an agent” explainer modal.

Patent Hygiene (dev workflow)
Create /docs/ip/workflow.md (don’t publicize INTERNAL algorithms; tag PRIVATE commits). Add a CI check that prevents publishing bundles containing INTERNAL comments. Provide a script to generate date-stamped design notes.

Data Migration & Exit (productized)
Implement org-wide export packs (JSON/CSV + manifest) and verified delete with tombstones; add e2e tests. Provide /docs/ops/exit.md with operator procedures.
```

## Build Plan for Codex
```
Mindset & model settings
- Use your code model in “architect/system” mode for the big orchestrator; temperature 0–0.2.
- Then hand generated files to a “code” mode for iterative fills/fixes; temperature 0–0.2 for code, 0.3–0.5 for UI copy.

1) Start a clean workspace
- Create an empty repo folder.

2) Feed the prompts (chunked)
- Paste Global Context once.
- Paste the Everything Orchestrator (Dev-Only). If your copilot has output limits, paste in two or three chunks (e.g., Parts 1–5, 6–9, 10–13).
- After each chunk, let it write files. If it prints the file tree first, ask it to “now output file contents for …” in small batches (service by service).

3) Install & run (Windows-safe)
- pnpm i
- pnpm -r build
- docker compose up -d
- pnpm -r test
- pnpm -w exec playwright test
- Common local env scripts: ./scripts/dev-up.ps1 and ./scripts/db-reset.ps1.

4) Iterate with Codex
- If a build step fails, copy the exact error and say: “Fix the error below and show unified diffs only.”
- For gaps (e.g., STP fixtures), say: “Add STP Phase 2 conformance fixtures and wire tests until e2e passes.”
- For UI adjustments, ask: “Refine BAS workspace table to virtualized DataTable; return only changed files.”

5) Wire real adapters later
- Keep mocks (PayToMock, ABR sandbox, SBR fixtures). Once you have real creds, ask: “Implement Provider X adapter by extending IPaymentRail; keep mocks for tests; add HMAC webhook verification and rotation.”

6) Deploy a minimal stack
- From /infra/iac: terraform init, terraform plan, terraform apply.
- Set env/SSM with your secrets. Re-run CI and e2e against staged.

7) Lock it down
- Protect main branch; require CI, security, SBOM checks.
- Schedule quarterly key rotation and IR tabletop drills.

Troubleshooting tips
- If the copilot truncates files, request: “Continue from <path>:<line>”.
- If large binary fixtures are needed, generate small JSON/CSV fixtures instead.
- Keep prompts scoped: one service or feature per follow-up for reliable outputs.
```

## Non-Development Items (Out of Scope for Prompts)
```
- External penetration test engagement and report.
- ATO onboarding/whitelisting and production credential issuance.
- Insurance procurement.
- Final legal review of Terms/Privacy.
```
