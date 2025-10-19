# Data Protection Impact Assessment

Last reviewed: 02 December 2024

## Overview

Birchal processes payroll, taxation, and banking data on behalf of Australian SMEs. The gateway acts as the primary ingress for Personally Identifiable Information (PII) including names, email addresses, Tax File Numbers (TFNs), and bank transactions.

## Lawful Basis & Purpose Limitation

- **APP 1/5:** Data is collected solely to deliver payroll reconciliation and Single Touch Payroll submissions. Collection notices are issued during onboarding and stored in the CRM.
- **APP 6:** Access is restricted to authorised personnel. RBAC ensures that employees can only see records for their assigned organisation.

## Data Minimisation

- TFNs are encrypted at rest and only decrypted for STP submissions.
- The privacy export endpoint (`GET /privacy/export`) provides customers with a complete data snapshot on request.
- Deletion requests are handled via `DELETE /privacy/users/:userId`, which enforces approval workflow and audit logging.

## Security Controls

- Mandatory MFA with token validation (see [`services/api-gateway/src/index.ts`](../../services/api-gateway/src/index.ts)).
- Rate limiting, CORS allowlists, and body-size caps prevent bulk extraction of customer data.
- Audit logs stored in `AuditEvent` provide forensic traceability.

## Notifiable Data Breach (NDB) Readiness

- The incident runbook is maintained in `docs/ops/runbooks/ndb-response.md` (includes 30-day assessment timer and communication templates).
- Evidence packages (logs, idempotency records, and AS4 receipts) are exported automatically for incident investigators.

## Data Subject Rights

- **Access:** Customers may request exports via the support portal; fulfilment SLA is 7 days.
- **Deletion:** Requests are validated against the compliance retention schedule. Non-critical data is purged immediately; mandated records are pseudo-anonymised.
- **Correction:** Users can update their contact information via the self-service portal. Changes are tracked in `AuditEvent`.

## Vendor & Supply Chain

- Third-party dependencies are tracked in the CycloneDX SBOM (`docs/security/sbom/latest.json`).
- Cloud providers (AWS, SendGrid) have signed DPAs and meet ISO 27001/ISO 27701 standards.

## Residual Risk Assessment

| Risk | Likelihood | Impact | Treatment |
| --- | --- | --- | --- |
| Compromise of API access token | Low | High | Short-lived tokens, MFA, rapid revocation via IdP. |
| Replay of financial transactions | Low | High | Stored idempotency keys and audit trail validation. |
| Insider misuse | Medium | Medium | RBAC, least privilege, quarterly access reviews, alerting on anomalous exports. |

## Review Cadence

The privacy officer and DSP compliance lead review this DPIA quarterly or whenever a material change occurs (new data categories, new processors, etc.).
