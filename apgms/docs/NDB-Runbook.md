# Notifiable Data Breach (NDB) Runbook

This runbook supports APGMS teams in responding to potential or confirmed notifiable data breaches under the Australian Privacy Act.

## Phase 1 — Assess (0 to 24 hours)

1. **Detect & Log**
   - Capture alert details in the incident tracker and assign an incident commander (IC).
   - Preserve volatile evidence (logs, session IDs, and system snapshots).
2. **Initial Assessment**
   - IC coordinates with Security Operations (SecOps) and Privacy Officer to determine if personal information is involved.
   - Classify the impact using the APGMS severity matrix; escalate to Executive Sponsor for SEV1 or higher.
3. **Decision Point**
   - Within 24 hours decide whether the event is likely to result in serious harm.
   - If unclear, proceed with containment while continuing investigation.

## Phase 2 — Contain (24 to 72 hours)

1. **Immediate Controls**
   - Disable compromised accounts, rotate credentials, and isolate affected systems.
   - Apply emergency patches or configuration changes approved by the IC.
2. **Data Handling**
   - Validate the scope of impacted records, including any exports triggered via `/privacy/export`.
   - Confirm deletion or suppression requests via `/privacy/delete` complete successfully for affected individuals.
3. **Stakeholder Updates**
   - Provide twice-daily updates to Executives, Legal, and Product via the incident Slack channel.
   - Prepare a draft OAIC notification and customer messaging for review.

## Phase 3 — Notify & Remediate (within 72 hours)

1. **OAIC Notice**
   - Submit notification to the Office of the Australian Information Commissioner (OAIC) using the template below.
   - Coordinate with Legal to issue customer communications.
2. **Customer Communication**
   - Deliver direct notices to impacted individuals, including recommended protective actions.
   - Update the APGMS status page and investor portal banner.
3. **Post-Incident Review**
   - Within 5 business days conduct a retrospective to capture lessons learned and backlog remediation tasks.
   - Update the risk register and privacy impact assessments.

## OAIC Notification Template

```
Subject: APGMS Notifiable Data Breach Notification — <Incident ID>

To the Office of the Australian Information Commissioner,

APGMS reports a notifiable data breach identified on <Date/Time>. The incident involved <Summary of incident> affecting <Number of individuals> individuals.

We have taken the following steps:
1. Containment actions: <Containment summary>
2. Assessment findings: <Key findings>
3. Communications: <Customer notification plan>

Individuals at risk may take the following recommended actions:
- <Suggested action 1>
- <Suggested action 2>

Primary contact for this incident:
- Name: <Incident Commander>
- Title: <Role>
- Email: <Email>
- Phone: <Phone>

APGMS will provide updates as new information becomes available.

Regards,
APGMS Privacy Office
```

## Contact Tree

- **Incident Commander (IC):** Security Operations on-call (PagerDuty escalation `SecOps-Primary`).
- **Privacy Officer:** privacy@apgms.example — accountable for OAIC liaison and customer notifications.
- **Legal Counsel:** legal@apgms.example — reviews regulatory filings and contractual commitments.
- **CTO:** cto@apgms.example — approves remediation spend and executive communications.
- **Customer Success Lead:** success@apgms.example — coordinates investor communications and portal updates.

Document owner: Privacy Officer. Review cadence: quarterly or after any privacy incident.
