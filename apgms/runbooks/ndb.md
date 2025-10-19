# Notifiable Data Breach Runbook

## Purpose
Guide security, legal, and product stakeholders through the OAIC Notifiable Data Breach (NDB) process.

## Roles
- **Incident Commander (IC):** Security duty lead coordinating response.
- **Comms Lead:** Prepares stakeholder messaging and regulator submissions.
- **Forensics Lead:** Owns evidence gathering and root-cause analysis.
- **Product Liaison:** Coordinates fixes, customer impact assessment, and release schedule.

## Phases
### 1. Assess
1. Activate the incident bridge and log the event in PagerDuty and Jira (`SEC-INC`).
2. Collect initial indicators, affected tenants, and data types. Preserve evidence in the `ir-evidence/` bucket.
3. Determine eligibility against OAIC NDB criteria using the decision checklist in Appendix A.

### 2. Contain
1. Disable compromised credentials, revoke API tokens, and isolate affected infrastructure nodes.
2. Apply configuration hotfixes or patches. Capture changes in Git and change-management records.
3. Monitor telemetry via OTEL dashboards to confirm containment.

### 3. Notify
1. Within 30 calendar days of becoming aware, decide if the breach is likely to result in serious harm. Document rationale in the OAIC template.
2. If notification required, prepare regulator submission using Template B and customer notice using Template C.
3. Coordinate with Customer Success for tenant outreach; track completion in the NDB tracker spreadsheet.

## OAIC 30-Day Decision Timeline
- **Day 0:** Incident declared, IC assigned, OAIC timer starts.
- **Day 1-7:** Complete forensic assessment, draft containment plan, and preliminary risk rating.
- **Day 8-21:** Implement fixes, monitor for recurrence, refine impact scope.
- **Day 22-28:** Finalize serious-harm determination, draft notifications, obtain executive approval.
- **Day 29-30:** Submit OAIC report if required; deliver customer communications; retro scheduled.

## Templates
- **Template A:** OAIC assessment checklist (`runbooks/templates/ndb-oaic-checklist.md`).
- **Template B:** Regulator notification letter (`runbooks/templates/ndb-oaic-letter.md`).
- **Template C:** Customer communication email (`runbooks/templates/ndb-customer-email.md`).

## Post-Incident
1. Conduct a blameless retrospective within 10 business days.
2. File corrective actions in Jira (`SEC-RCA`).
3. Update threat models and security test coverage as needed.
