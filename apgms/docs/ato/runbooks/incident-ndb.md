# Incident Response Runbook — OAIC Notifiable Data Breach

## Purpose
Structured procedure to assess, contain, and notify for incidents that may trigger OAIC NDB obligations.

## Roles
- Incident Commander (IC)
- Privacy Officer
- Security Operations (SecOps)
- Communications Lead
- Legal Counsel

## Workflow
1. **Assess (Day 0)**
   - Triage alert and establish incident ticket.
   - Determine if personal information is involved and assess likely serious harm.
   - Start 30-day OAIC decision timer and record in incident tracker.
   - Convene IC, Privacy Officer, Legal to classify breach likelihood.
2. **Contain (Day 0-2)**
   - Isolate affected systems, revoke compromised credentials, apply patches.
   - Capture forensic images and preserve volatile data.
   - Implement compensating controls (e.g., rate limiting, additional monitoring).
   - Update stakeholders every 4 hours during active containment.
3. **Notify (Decision within 30 days)**
   - If serious harm likely: prepare OAIC statement and affected individual notices.
   - Coordinate with Communications for public messaging and FAQs.
   - Submit OAIC statement via secure portal and document confirmation receipt.
   - Notify regulators/partners (ASIC, Birchal) per contractual obligations.
   - If decision cannot be reached within 30 days, escalate to executive sponsor.

## Timelines
- 30-day statutory window to assess notifiability.
- Notification to individuals and OAIC must occur as soon as practicable after confirmation.
- Post-incident review within 5 business days of closure.

## Documentation Templates
- Incident ticket template (Jira) with OAIC timer fields.
- OAIC statement template stored in `docs/ato/templates/oaic-statement.md`.
- Customer notification letter template stored in `docs/ato/templates/customer-notice.md`.
- Post-incident review checklist in `docs/ato/templates/post-incident-review.md`.

## Metrics and Evidence
- Attach timeline of actions, forensic artifacts, and communication logs to incident record.
- Record containment efficacy and residual risk rating.
- Track remediation tasks to completion with assigned owners.
