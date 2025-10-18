# OAIC Notifiable Data Breach (NDB) Runbook

This runbook covers the mandatory steps for responding to any suspected or confirmed Notifiable Data Breach under Australia's Privacy Act. Follow the phases in order: **Assess → Contain → Notify**.

## 1. Trigger Criteria
- Unauthorised access, disclosure, or loss of personal information involving an entity covered by the Privacy Act 1988 (Cth).
- Any security incident that could reasonably result in serious harm to individuals.
- Reports from staff, vendors, monitoring tools, or third parties indicating a possible breach.

## 2. Immediate Actions (Assess)
1. **Start the 30-day decision timer** as soon as a potential eligible data breach is suspected. Record the start time in the incident log.
2. **Activate the Incident Response Lead (IR Lead).**
3. **Preserve evidence** by isolating affected systems and prohibiting changes that could overwrite logs.
4. **Classify the incident severity** (critical/high/medium/low) based on potential harm and data sensitivity.
5. **Assemble the response team** (see Roles and Responsibilities below).

## 3. Containment Steps (Contain)
- Disconnect or isolate affected networks or user accounts.
- Revoke compromised credentials and enforce password resets.
- Patch vulnerabilities exploited in the incident.
- Disable malicious processes, remove malware, or roll back unauthorised changes.
- Coordinate with hosting providers or vendors to secure third-party systems.
- Document every action taken, including timestamps and responsible personnel.

## 4. Investigation and Assessment (Assess)
- Conduct forensic analysis to determine: attack vector, timeframe, data types affected, and individuals impacted.
- Evaluate the likelihood of serious harm, considering data sensitivity, security protections, and potential misuse.
- Update management with preliminary findings and risk assessment.
- If the incident is not an eligible data breach, document justification and close the 30-day timer outcome.

## 5. Notification Planning (Notify)
- If serious harm is likely, prepare notifications to the **Office of the Australian Information Commissioner (OAIC)** and affected individuals.
- Determine the most appropriate notification channel (email, SMS, postal, public notice).
- Prepare FAQ scripts and internal communications to support customer service teams.
- Coordinate with legal counsel before dispatching any notices.

## 6. Roles and Responsibilities

| Role | Responsibilities |
| --- | --- |
| Incident Response Lead | Coordinate the response, track the 30-day timer, approve containment actions, liaise with executives. |
| Security Operations | Perform technical containment, collect forensic evidence, and monitor for ongoing threats. |
| Legal & Privacy | Assess Privacy Act obligations, review notification content, advise on regulatory risk. |
| Communications Lead | Draft external and internal notices, manage media inquiries, align messaging with legal guidance. |
| Executive Sponsor | Approve major decisions, allocate resources, and communicate with the board. |
| HR / People Team | Support impacted employees, manage internal notifications and welfare. |

## 7. Notification Requirements
- **OAIC Notification:** Submit the OAIC NDB statement using the latest form, summarising incident details, data types, harm assessment, containment, and ongoing mitigation.
- **Individuals:** Provide timely, clear information about the breach, what data was involved, recommended protective steps, and contact details for support.
- **Record Keeping:** Store copies of all notices, submission confirmations, and decision logs in the incident record repository.

## 8. Post-Incident Activities
- Conduct a post-incident review within 10 business days of closure.
- Identify control gaps, remediation tasks, and policy updates.
- Update training materials based on lessons learned.
- Close the incident only after all corrective actions are assigned and tracked.

## 9. Evidence Checklist
Collect and store the following artefacts in the incident repository:
- Incident timeline with timestamps and responsible parties.
- System, application, and security logs covering the incident window.
- Forensic images or reports from affected systems.
- Communication records (emails, chat transcripts, meeting notes).
- Copies of notifications sent to OAIC and individuals.
- Risk assessments, legal advice summaries, and executive approvals.
- Remediation task list and post-incident review report.

## 10. Contact Points
- OAIC NDB team: [https://www.oaic.gov.au/privacy/notifiable-data-breaches](https://www.oaic.gov.au/privacy/notifiable-data-breaches)
- Local law enforcement or ACSC if criminal activity is suspected.
- External legal counsel and cyber incident response partners, as per vendor roster.

Maintain this runbook annually to align with OAIC guidance and organisational changes.
