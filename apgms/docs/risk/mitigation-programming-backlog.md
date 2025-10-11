# Risk mitigation programming backlog

This backlog decomposes the risk mitigation plan into actionable engineering tasks. Each task targets a specific product or platform component and can be scheduled directly into delivery sprints. Non-programming deliverables (e.g. audits, contracts) are excluded.

## 1. Government / Policy Compliance

### 1.1 Privacy notices must cover APP / TFN handling
- **Component:** `webapp` customer onboarding and profile flows
- **Tasks:**
  1. Add APP-specific copy blocks to privacy & collection modals, including TFN storage statement and explicit consent checkbox state machine.
  2. Extend localisation bundle with APP/TBN consent strings and ensure feature-flagged rollout for compliance review.
  3. Capture automated screenshot regression via Playwright to attach to legal sign-off memo.
- **Definition of done:** Updated UI copy behind feature flag, tests and screenshots stored under `docs/privacy/`.

## 2. ATO DSP Assessor (OSF/SBR/STP)

### 2.1 Demonstrate DEK rotation
- **Component:** `services/platform` key management worker (create if missing) + infra scripts
- **Tasks:**
  1. Implement rotation job invoking cloud key vault API with configurable DEK alias mapping.
  2. Persist rotation run logs into `audit` service and expose CLI to export logs as CSV.
  3. Add integration test that encrypts sample payloads before/after rotation and asserts ciphertext change while decrypting successfully.

### 2.2 SBR/STP conformance artefacts
- **Component:** `services/sbr`, `services/connectors`
- **Tasks:**
  1. Create automated end-to-end harness hitting ATO sandboxes (positive + negative scenarios) and saving receipts to `/docs/dsp-osf/conformance/`.
  2. Generate error-path screenshots by scripting headless UI flows for rejection handling, storing results in the same folder.
  3. Wire CI job to run nightly and surface failures in status dashboard.

## 3. Investor readiness

### 3.1 Integration roadmap publication
- **Component:** `docs/partners`
- **Tasks:**
  1. Produce roadmap markdown with phased milestones for Xero, MYOB, QBO, and CDR ingest, referencing engineering capacity charts.
  2. Publish static site build step that converts roadmap to stakeholder PDF for investor portal.

## 4. Customer (Micro/Small Business)

### 4.1 Accountant collaboration flow
- **Component:** `webapp`
- **Tasks:**
  1. Design shared workspace permission model (viewer, editor, preparer) and persist invites via `services/registries`.
  2. Implement invite UI (email entry, role selection, audit log note) with acceptance flow in accountant portal.
  3. Add end-to-end Cypress tests covering invite issuance, acceptance, and revocation.

### 4.2 Pricing clarity
- **Component:** `webapp` marketing site
- **Tasks:**
  1. Implement Starter plan hero section featuring reconciliation + BAS draft bullets.
  2. Add pricing FAQ accordion with guaranteed monthly fee explanation.
  3. Localise pricing content and wire analytics event tracking for plan CTA clicks.

## 5. Tax Agent / Accountant

### 5.1 Review mode with checklist & e-sign
- **Components:** `webapp`, `services/recon`, `services/payments`
- **Tasks:**
  1. Build review workspace UI with diff viewer comparing draft vs. ledger data, and server endpoint to supply diff payloads.
  2. Create configurable checklist builder with per-item sign-off status stored in reconciliation service.
  3. Integrate e-sign provider SDK to capture signatures, storing artefacts in secure blob storage and exposing download link to agents.

### 5.2 Xero connector with conflict resolution
- **Component:** `services/connectors/xero`, `webapp`
- **Tasks:**
  1. Implement delta sync engine to detect conflicting transactions and surface them via webhook to UI.
  2. Build conflict resolution modal with adjustment audit trail persisted in `audit` service.
  3. Document connector configuration and troubleshooting in `/docs/partners/xero.md`.

### 5.3 SBR lodge authority flow
- **Component:** `webapp`, `services/registries`
- **Tasks:**
  1. Create agent-of-record consent screens with dynamic form validations mapped to ATO requirements.
  2. Persist signed authority tokens and expose compliance export endpoint.
  3. Add automated PDF snapshot generation for legal archive.

## 6. Bank / Payments Partner

### 6.1 Loss controls & communications
- **Component:** `services/payments`, `webapp`
- **Tasks:**
  1. Map chargeback/return codes to internal loss categories and trigger automated customer notifications with templating support.
  2. Enforce per-organisation hard limits configurable via admin UI, including anomaly auto-pause workflow.
  3. Document runbook and notification templates in `/docs/payments/loss-controls.md`.

### 6.2 Operational metrics dashboard
- **Component:** `status` service / data pipeline
- **Tasks:**
  1. Build metrics ETL job aggregating debit success, return reasons, and reconciliation MTTR into warehouse.
  2. Expose dashboard widgets on status site with export to monthly PDF report.
  3. Add automated alerting for threshold breaches with Slack/email integration.

## 7. Payroll Software Partner

### 7.1 Pre-submit PAYGW validation via webhook/embed
- **Component:** `services/payroll-integrations`, SDK package
- **Tasks:**
  1. Ship webhook endpoint with idempotent correlation IDs and signature verification.
  2. Publish TypeScript SDK (npm) providing embed helpers and local validation utilities.
  3. Provide sample integration tests in `tests/payroll-integrations` covering happy path and failure retries.

### 7.2 Edge case roadmap
- **Component:** `docs/payroll`
- **Tasks:**
  1. Draft joint roadmap doc covering STSL/TFT deferral handling, linking to regression test results.
  2. Automate generation of test matrix from integration tests to embed in documentation.

## 8. Accounting Platform Integrations

### 8.1 Rate limit handling
- **Component:** `services/connectors`
- **Tasks:**
  1. Implement exponential backoff policy shared library and apply to Xero/MYOB/QBO connectors.
  2. Build adverse path integration tests simulating throttling responses with log capture for evidence.
  3. Surface rate limit metrics on integration dashboard.

### 8.2 Reconciliation explainers
- **Component:** `webapp`
- **Tasks:**
  1. Add in-app explainer panel that detects mismatched balances and provides step-by-step guidance.
  2. Create content management interface for ops to edit explainer copy without redeploys.
  3. Capture screenshots and release announcement draft for `/docs/success/releases.md`.

## 9. Cross-cutting operations

### 9.1 Status page & SLOs
- **Component:** `status`
- **Tasks:**
  1. Launch public status site with uptime/error budget charts sourced from monitoring APIs.
  2. Implement monthly uptime report generator exporting PDFs to `/status/reports/`.
  3. Add CI check ensuring new services declare SLOs in configuration.

### 9.2 Stakeholder one-pagers automation
- **Component:** `docs`
- **Tasks:**
  1. Build script to templatise persona one-pagers pulling data from readiness trackers.
  2. Store rendered PDFs in `/docs/stakeholder-one-pagers/` with versioned filenames.
  3. Hook script into release pipeline so updates publish automatically.
