# APGMS Programming Task Backlog

This backlog translates the combined multi-stakeholder review of the Automated PAYGW & GST Management System (APGMS) into actionable engineering work. Each task focuses on functionality or evidence required for pilot readiness, ATO DSP accreditation, and investor diligence.

---

## 1. Security & Compliance Evidence

### 1.1 External Penetration Test Tracking
- **Goal:** Capture results, remediation plan, and verification artifacts from an independent penetration test.
- **Implementation Notes:**
  - Add secure storage bucket + schema for evidence uploads (JSON + PDF).
  - Extend security dashboard service to ingest remediation status via REST endpoint.
  - Implement reminders in ops worker for overdue fixes.
- **Definition of Done (DoD):** Evidence view renders in compliance console; remediation tickets auto-generated via webhook; automated report export to DSP OSF pack.

### 1.2 Key Rotation Audit Trail
- **Goal:** Provide verifiable logging and reporting for DEK/key rotation activities.
- **Implementation Notes:**
  - Instrument KMS integration to emit signed rotation events.
  - Persist rotation manifests in audit ledger; expose GraphQL resolver for compliance view.
  - Add unit tests covering malformed or missing rotation data.
- **DoD:** Compliance UI shows last rotation time + verifier hash; failing rotations trigger pager alert; integration tests cover rotation schedule.

### 1.3 Notifiable Data Breach (NDB) Tabletop Recorder
- **Goal:** Record evidence of NDB tabletop drills to satisfy privacy requirements.
- **Implementation Notes:**
  - Create `privacy_drills` table with participant, scenario, outcome, timestamp.
  - Build admin form in webapp for compliance team to log drills with attachments.
  - Generate PDF summary via existing reporting worker.
- **DoD:** Drill logs appear in compliance reports; export includes scenario notes and sign-off.

---

## 2. Accessibility & UX Compliance

### 2.1 Manual Accessibility Audit Module
- **Goal:** Collect and display findings from manual WCAG 2.2 AA audits alongside automated checks.
- **Implementation Notes:**
  - Introduce `accessibility_audits` schema storing audit items, severity, and remediation owner.
  - Extend frontend accessibility dashboard to filter by automated vs manual findings.
  - Provide CSV import template and validation using Zod.
- **DoD:** Compliance dashboard differentiates manual findings; regression tests cover CSV ingestion; accessibility report export bundles both finding types.

### 2.2 Collection Notice & TFN Handling Copy Injection
- **Goal:** Surface mandatory privacy wording across onboarding and data-entry views.
- **Implementation Notes:**
  - Add copy blocks to shared content service with localization keys.
  - Update onboarding wizard and TFN input components to render notices with acknowledgement checkbox.
  - Include analytics event for notice acknowledgement.
- **DoD:** UX review confirms notices render on all TFN capture flows; acknowledgement recorded in audit log; existing e2e onboarding tests updated.

---

## 3. Integrations & Collaboration

### 3.1 Accountant Review Mode
- **Goal:** Allow tax agents to review, annotate, and approve client filings before submission.
- **Implementation Notes:**
  - Introduce reviewer role with scoped permissions and audit trail entries.
  - Create review workspace UI with diff view of calculated PAYGW/GST results and comment threads.
  - Implement e-signature capture using existing document service.
- **DoD:** Reviewer can request changes, approve, or reject filings; audit trail captures actions; notification system alerts clients.

### 3.2 Xero Connector (Read-Only Pilot)
- **Goal:** Sync invoices, payroll, and tax codes from Xero for reconciliation and review.
- **Implementation Notes:**
  - Build OAuth 2.0 app flow with token refresh worker.
  - Implement data ingestion pipelines mapping Xero entities to internal schema with correlation IDs.
  - Provide reconciliation diff report highlighting discrepancies.
- **DoD:** Pilot customer can link Xero org, view sync status, and run reconciliation diff; integration tests cover error-path retries; rate limiting respected per Xero guidelines.

---

## 4. Payment & Reconciliation Metrics

### 4.1 Loss-Control Metrics Dashboard
- **Goal:** Track debit-return rates and reconciliation accuracy demanded by banking partners.
- **Implementation Notes:**
  - Extend payments service to emit success/failure events with reason codes.
  - Aggregate metrics in analytics warehouse and expose via dashboard widgets.
  - Add alert thresholds configurable per partner SLA.
- **DoD:** Dashboard displays 30/90-day trends; SLA breaches generate alerts; partners can export CSV evidence.

### 4.2 Reconciliation Pass Token (RPT) Monitoring
- **Goal:** Provide visibility into the generation and validation of RPTs for each filing cycle.
- **Implementation Notes:**
  - Add background job verifying hash chain integrity nightly.
  - Surface anomalies in audit console with remediation checklist.
  - Include API endpoint for partners to verify token status.
- **DoD:** Monitoring job reports success/failure; anomalies create incidents; API returns deterministic verification payload.

---

## 5. Product & Commercial Enablement

### 5.1 Pricing Page & Success Playbooks
- **Goal:** Publish clear pricing tiers and onboarding playbooks to support go-to-market efforts.
- **Implementation Notes:**
  - Build marketing site section with tiered pricing cards and FAQ.
  - Create success playbook templates stored in CMS with versioning.
  - Instrument analytics to track plan interest.
- **DoD:** Pricing page deployed with responsive layout; playbooks downloadable; marketing analytics events captured.

### 5.2 Pilot KPI Tracker
- **Goal:** Measure pilot progress against targets (50–100 SMBs, 5–8 firms, first live SBR BAS lodge).
- **Implementation Notes:**
  - Implement dashboard summarizing active pilots, lodgements, and satisfaction scores.
  - Ingest partner feedback surveys and attach to accounts.
  - Provide investor-friendly export summarizing KPIs.
- **DoD:** Dashboard updates daily; exports attach to investor data room; pilot milestones flagged with status badges.

---

## 6. Intellectual Property Enablement

### 6.1 Patent Evidence Repository
- **Goal:** Capture metrics and documentation supporting provisional patent claims.
- **Implementation Notes:**
  - Store case studies demonstrating reduced duplicate debits and reconciliation errors.
  - Add tagging for innovations (Wallets, RPTs, Audit Manifests, Schedule Diff Engine).
  - Automate monthly snapshot report for patent counsel.
- **DoD:** Repository populated with metrics and narratives; monthly report delivered via email automation; counsel access with audit logging.

---

## Delivery Guidance
- Sequence security and compliance tasks (Section 1) ahead of integrations to unblock ATO accreditation timelines.
- Prioritise accountant review mode and Xero connector in parallel to secure pilot traction.
- Ensure each task produces auditable evidence consumable by DSP assessors, investors, and partners.

