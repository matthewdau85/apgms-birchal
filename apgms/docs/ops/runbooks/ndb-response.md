# OAIC Notifiable Data Breach Response Plan

**Objective:** Assess, contain, and notify affected parties within the OAIC-mandated 30-day window.

## Roles

- **Incident Commander:** SRE manager on call.
- **Privacy Officer:** Legal representative responsible for OAIC liaison.
- **Communications Lead:** Coordinates customer and media messaging.

## Timeline Checklist

| Time | Action |
| --- | --- |
| T0 | Detect incident, create PagerDuty incident `NDB`. Classify severity. |
| T0 + 1h | Assemble response team on secure bridge. Initiate forensic evidence capture (AuditEvent export, idempotency logs). |
| T0 + 4h | Contain threat, revoke compromised credentials, and publish preliminary customer notice if required. |
| T0 + 24h | Draft OAIC notification using templates in `docs/privacy/templates/`. |
| T0 + 7d | Provide interim remediation update to customers and regulators. |
| T0 + 30d | Submit final OAIC statement and close incident with executive review. |

## Communication Templates

- Customer email templates available under `docs/privacy/templates/customer-notice.md`.
- Regulator notification template under `docs/privacy/templates/oaic-notice.md`.

## Post-Incident

- Run a full post-incident review within 10 business days.
- Track remediation actions in Jira project `NDB`.
