# Privacy and Data Handling Posture

This note explains how APGMS complies with Australian Privacy Principles (APP) 12 and 13 and outlines our Notifiable Data Breach (NDB) response. It complements the security commitments in [SECURITY.md](./SECURITY.md).

## Data Inventory

- **Primary records** – Customer organisations, users, and bank line items are stored in Postgres via Prisma models defined in [`shared/prisma/schema.prisma`](../shared/prisma/schema.prisma).
- **Derived data** – Audit events, payment routing decisions, and reconciliation outputs live in their respective domain services. Each dataset inherits the retention and deletion policies described below.

## APP 12 – Access and Export Requests

1. **Intake** – Requests are logged in the privacy queue and acknowledged within two business days. Identity is verified through the IdP before any export is initiated.
2. **Extraction** – Data owners export raw records using Prisma utilities maintained under [`scripts/`](../scripts/) (for example `export-dump.ps1`). Outputs are delivered as encrypted CSV/JSON via secure download.
3. **Redaction** – Fields containing third-party information are redacted per legal guidance. Sensitive banking fields are encrypted in transit to the requester.
4. **Closure** – Completion is documented in the privacy register together with a link to the exported artefact held in the secure evidence store under [`docs/evidence/README.md`](./evidence/README.md).

## APP 13 – Correction and Deletion

1. **Validation** – Identity verification mirrors the APP 12 procedure. Requests must specify whether correction or deletion is required.
2. **Correction workflow** – Data stewards correct inaccuracies directly in the relevant service. Any structural updates trigger regeneration of downstream aggregates to maintain integrity.
3. **Deletion workflow** – Logical deletions are executed via Prisma with cascading removal of dependent records (see the `onDelete: Cascade` policy for `User` and `BankLine`). Backups older than 30 days are purged to ensure deleted data is not resurrected.
4. **Confirmation** – Requesters receive confirmation that changes propagated through all services. Audit logs for the actions are preserved for 12 months.

## Notifiable Data Breach (NDB) Runbook

1. **Detect and Triage (Day 0)** – Incidents are escalated to the privacy officer within one hour of detection. Initial facts are captured in the security incident tracker.
2. **Investigation (Days 0–3)** – Impact scope, affected data classes, and containment measures are documented. Legal is engaged to assess NDB criteria.
3. **Notification decision (Day 3)** – If the breach is likely to result in serious harm, the OAIC notification template is drafted immediately.
4. **Notification and Remediation (Day 4–30)** – Impacted customers are notified using pre-approved templates located in [`docs/evidence/README.md`](./evidence/README.md). Remediation tasks are tracked in the incident board with owners and deadlines.
5. **30-day timer** – A countdown is started at detection time. If notification has not been finalised by Day 30, an explicit decision by the privacy officer is required and must be recorded.
6. **Post-incident review (Day 30+)** – Lessons learned feed into backlog items and updated controls. Outcomes are reflected in [OSF-QUESTIONNAIRE.md](./OSF-QUESTIONNAIRE.md).

All breaches, regardless of notification status, are recorded in the privacy incident register and cross-referenced with the operational runbook in [`docs/ops/runbook.md`](./ops/runbook.md).
