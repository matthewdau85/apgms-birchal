# OAIC Notifiable Data Breach (NDB) Response Runbook

## Purpose
Provide a structured operational guide for identifying, containing, assessing, and reporting eligible data breaches under the Australian Privacy Act 1988 and the OAIC Notifiable Data Breaches scheme.

## Scope
Applies to all suspected or confirmed data breaches involving personal information handled by the organisation, its contractors, or third-party processors.

---

## 1. Assess
1. **Trigger**: Incident detected via monitoring alert, internal report, or third-party notification.
2. **Immediate Actions**
   - Log incident in security incident register with timestamp and reporter details.
   - Preserve current system state (snapshots, logs) prior to containment changes.
   - Appoint Incident Manager (IM) and convene Incident Response Team (IRT).
3. **Initial Triage**
   - Classify data types involved (personal, sensitive, financial, credentials).
   - Determine affected systems, users, geographies.
   - Evaluate potential harm (serious physical, psychological, financial, reputational).
4. **Eligibility Assessment**
   - Apply OAIC three-point test: eligible data, likely serious harm, no remedial action preventing harm.
   - Initiate **30-day decision timer**; record deadline and owner (Privacy Officer).
5. **Escalation**
   - Notify Legal and Privacy teams of suspected breach within 2 hours.
   - Inform Executive Sponsor if harm likely or critical systems impacted.

## 2. Contain
1. Isolate affected systems or network segments while maintaining evidence integrity.
2. Disable compromised credentials, API keys, or access tokens.
3. Implement temporary compensating controls (e.g., WAF rules, rate limits).
4. Coordinate with third parties to suspend data sharing pipelines if necessary.
5. Document all containment actions with timestamps and responsible individuals.

## 3. Eradicate
1. Identify root cause (e.g., vulnerability, misconfiguration, insider threat).
2. Remove malware, disable malicious accounts, patch exploited vulnerabilities.
3. Validate backups and ensure clean system images for restoration.
4. Monitor for recurrence indicators; adjust detection rules and signatures.
5. Perform peer review of remediation steps before proceeding to recovery.

## 4. Recover
1. Restore services from verified clean backups or gold images.
2. Re-enable access in a staged manner with enhanced monitoring.
3. Conduct regression testing and security validation before full production release.
4. Communicate service restoration status to stakeholders and customers.
5. Schedule post-incident review meeting within 5 business days of recovery.

## 5. Notify
1. **Decision Point (within 30 days)**
   - Privacy Officer, with Legal counsel, determines if breach is notifiable.
   - If unable to conclude, treat as eligible breach and proceed with notification.
2. **OAIC Notification**
   - Prepare statement including incident summary, data types, affected individuals, containment, remediation, and support measures.
   - Submit via OAIC Notifiable Data Breach form.
3. **Individual Notification**
   - Use appropriate template (direct or public notice) tailored to audience.
   - Provide guidance on protective steps (password resets, credit monitoring).
4. **Internal Communication**
   - Brief Executive team and Board on outcome, response, and next steps.
   - Coordinate with Communications for media handling.
5. **Post-Notification Actions**
   - Monitor enquiries and track responses.
   - Update risk register and initiate remediation projects.

---

## Roles and RACI Matrix

| Role | Description | R | A | C | I |
| --- | --- | --- | --- | --- | --- |
| Incident Manager (IM) | Leads tactical response, coordinates IRT | X |   | X | X |
| Privacy Officer (PO) | Oversees privacy obligations, decision timer |   | X | X | X |
| CISO / Security Lead | Provides security expertise, approves remediation | X |   | X | X |
| Legal Counsel | Interprets regulatory duties |   |   | X | X |
| Communications Lead | Handles internal/external messaging |   |   | X | X |
| Executive Sponsor | Provides executive oversight, resource allocation |   |   |   | X |
| IT Operations | Executes technical containment/recovery | X |   |   | X |
| HR | Manages insider-related actions |   |   | X | X |

*R = Responsible, A = Accountable, C = Consulted, I = Informed.*

---

## 30-Day Decision Timer Procedure
1. **Start**: Privacy Officer records timer start in incident register at first suspicion.
2. **Tracking**: Timer deadline displayed on incident dashboard; reminders at day 7, 14, 21, 28.
3. **Escalation**: If deadline at risk, Incident Manager escalates to Executive Sponsor.
4. **Completion**: Record determination outcome, date, and approvers. If notification required, capture submission references.
5. **Audit**: Retain timer records for minimum 7 years.

---

## Evidence Collection Checklist
- [ ] Incident ticket with timestamps, reporter, initial classification.
- [ ] System logs (application, security, access) preserved with hashes.
- [ ] Network captures or firewall logs illustrating breach activity.
- [ ] Forensic images or snapshots of affected systems.
- [ ] List of compromised accounts, credentials, or data elements.
- [ ] Communication transcripts (email, chat, meeting notes).
- [ ] Containment and remediation action logs with responsible parties.
- [ ] Impact assessment, risk analysis, and harm evaluation documentation.
- [ ] Decision timer records, notification approvals, and submission receipts.
- [ ] Post-incident review report and lessons learned.

---

## Post-Incident Review
1. Conduct review within 10 business days of closure.
2. Identify control failures, process gaps, and improvement opportunities.
3. Update policies, training, and technical controls.
4. Report outcomes to Risk Committee and track remediation actions to completion.
