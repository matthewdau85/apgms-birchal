# OAIC Notifiable Data Breach (NDB) Response Runbook

**Scope:** Applies to all suspected or confirmed breaches involving personal information regulated under the Australian Privacy Act.

## Immediate Response Timeline
- **T+0 mins:** Incident discovered or reported to Security Operations (SecOps) on-call.
- **Within 30 mins:** Duty Incident Manager (IM) validates incident, opens case in incident platform, assigns Severity.
- **Within 2 hrs:** IM convenes Response Team (Legal, Privacy Officer, Communications, Engineering Lead) and documents initial findings.
- **Within 24 hrs:** Confirm breach status, implement containment, and determine notifiability.
- **Within 72 hrs:** Prepare notifications, obtain executive sign-off, notify individuals and Office of the Australian Information Commissioner (OAIC) if required.

## Roles & Responsibilities
| Role | Primary Contacts | Key Duties |
| --- | --- | --- |
| Incident Manager (IM) | SecOps on-call | Lead assessment & containment, maintain log, coordinate team. |
| Privacy Officer | Privacy@company | Interpret NDB criteria, coordinate OAIC liaison. |
| Legal Counsel | Legal on-call | Advise on obligations, review communications. |
| Engineering Lead | Relevant service owner | Technical investigation, containment, recovery. |
| Communications Lead | Corporate comms | Draft messaging for individuals, media, partners. |
| Evidence Custodian | Security analyst | Preserve artefacts, chain-of-custody. |

## Phase 1: Assess
1. **Trigger & triage:** IM records incident details (who/what/when) and severity in incident system.
2. **Assemble team:** Page roles above; confirm availability; schedule situation room bridge.
3. **Initial fact-finding:** Engineering Lead gathers logs, access records, and affected systems; Privacy Officer identifies personal data involved; capture all data sources in evidence log.
4. **Determine NDB applicability:** Use Privacy Act criteria (serious harm, remedial actions). Escalate uncertain cases to Legal & Privacy for decision within 24 hrs.
5. **Decision point:** If not notifiable, document rationale and close with post-incident review; if potentially notifiable, proceed to Contain.

## Phase 2: Contain & Eradicate
1. **Stabilise systems:** Isolate affected infrastructure (disable compromised accounts, revoke tokens, block malicious IPs).
2. **Preserve evidence:** Evidence Custodian snapshots systems, exports relevant logs, hashes artefacts; store in secure evidence repository.
3. **Remediation plan:** Engineering Lead drafts action plan for fixes and monitoring; IM tracks tasks in incident board.
4. **Stakeholder updates:** Provide hourly updates to leadership; document status in incident timeline.

## Phase 3: Notify & Recover
1. **Assess harm & impacted individuals:** Privacy Officer quantifies affected records, risk of serious harm, and required notifications.
2. **Draft notices:** Communications Lead prepares individual and OAIC notices using templates. Legal reviews before distribution.
3. **Notify individuals:** Deliver by most direct method (email, letter, in-product messaging) as soon as practicable after confirmation, typically within 72 hrs.
4. **Notify OAIC:** Submit statement via OAIC Notifiable Data Breach form; log submission ID and timestamp.
5. **Post-notification support:** Establish hotline/email support, FAQs, and credit monitoring if warranted. Track inquiries.

## Documentation & Evidence Collection
- Maintain central incident log including decisions, timestamps, contacts.
- Store artefacts (logs, screenshots, system images) in read-only evidence repository; maintain chain-of-custody form.
- Record all communications drafts and approvals.
- Schedule post-incident review within 7 days of containment to capture lessons learned and control improvements.

## Escalation & Contact Points
- **Emergency:** IM contacts CISO if severity is High/Critical.
- **Regulators/Partners:** Privacy Officer coordinates all external communications.
- **After Hours:** Use on-call rotation numbers in SecOps runbook appendix.
