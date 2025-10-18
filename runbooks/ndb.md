# Notifiable Data Breach (NDB) Runbook

_Last reviewed: {{REVIEW_DATE}}_

## Purpose
This runbook guides Birchal responders through assessment, containment, and notification tasks for Notifiable Data Breaches (NDB) under the OAIC scheme.

## Trigger criteria
Begin this runbook when **any** of the following occur:
- Personal information handled by Birchal is lost or accessed/ disclosed without authorisation.
- Systems storing regulated datasets (investor records, issuer onboarding, payment data) show compromise indicators.
- Third parties (vendors, regulators, law enforcement) alert us to a potential breach affecting Birchal-held personal information.
- Incident responders judge that data unavailability could lead to serious harm for individuals.

## 30-day decision clock
- **T0:** When the incident response lead confirms that an eligible data breach _may_ have occurred, start the 30-day OAIC assessment period.
- **T+30 days:** Birchal must decide whether the breach is notifiable. If the assessment cannot be finished inside 30 days, escalate to the Executive Sponsor and document the reasons.
- Track the decision deadline in the incident tracker, including owner, current status, and blockers.

## Roles and responsibilities
| Role | Responsibilities |
| --- | --- |
| Incident Response Lead (IR Lead) | Owns the runbook, coordinates assessment, documents timeline, approves communications, ensures deadlines are met. |
| Security Engineering | Investigates root cause, implements containment/eradication, gathers evidence, maintains logging. |
| Legal & Compliance | Interprets OAIC obligations, drafts notifications, validates decision to notify, liaises with regulators. |
| Communications Lead | Prepares user-facing messaging, aligns with legal guidance, coordinates media responses. |
| Executive Sponsor | Provides executive decisions, allocates resources, approves public statements. |
| Data Protection Officer (if appointed) | Confirms data categories affected, reviews containment, signs-off on risk of serious harm. |

## Containment and assessment steps
1. **Stabilise systems**
   - Isolate affected infrastructure (disable compromised accounts, block malicious IPs, rotate credentials).
   - Engage vendors if third-party systems are involved.
2. **Preserve evidence**
   - Enable forensics logging retention, snapshot affected systems, export relevant audit logs.
3. **Data impact analysis**
   - Map compromised data against the [Birchal data inventory](../apgms/docs/data-map.md).
   - Determine types and volumes of personal information and whether encryption/key compromise occurred.
4. **Risk evaluation**
   - Assess likelihood of serious harm (financial loss, identity theft, reputational damage).
   - Record reasoning in the incident ticket.
5. **Decision checkpoint**
   - Present findings to Legal & Compliance and Executive Sponsor.
   - Confirm whether breach meets NDB notification threshold before the 30-day deadline.

## Communications templates

### User notification (draft)
> **Subject:** Important information about your Birchal data
>
> Hello {{RecipientName}},
>
> We recently detected a security incident involving your personal information. Based on our investigation:
> - **What happened:** {{Brief description}}
> - **What information was involved:** {{Data elements}}
> - **Actions we have taken:** {{Containment/mitigation steps}}
> - **How you can protect yourself:** {{Protective steps}}
>
> We apologise for the concern this may cause. Our support team is ready to help at {{SupportEmail}} or {{SupportPhone}}. We will continue to update you as we complete the investigation.
>
> Regards,
> Birchal Security Team

### OAIC notification (draft)
> **Subject:** NDB notification – Birchal {{IncidentReference}}
>
> Dear OAIC case officer,
>
> Birchal notifies the OAIC of an eligible data breach under the Notifiable Data Breaches scheme.
>
> - **Organisation details:** Birchal Financial Services Pty Ltd
> - **Contact person:** {{IR Lead name, title, phone, email}}
> - **Description of breach:** {{Summary of events, systems, timelines}}
> - **Affected individuals:** {{Number or estimate, cohort description}}
> - **Information compromised:** {{Categories of personal information}}
> - **Containment actions:** {{Immediate response steps}}
> - **Remediation and support:** {{Support offered to individuals}}
> - **Notification plan:** {{How and when affected individuals are/will be notified}}
>
> Attach supporting documentation (timeline, forensic summary) and reference the NDB decision log.
>
> Kind regards,
> {{Legal & Compliance contact}}

## Stakeholder communications
- Maintain a single source of truth in the incident ticket (status, decision owner, due date).
- Hold daily stand-ups during the active investigation window.
- Provide executive updates at least every 48 hours or when material facts change.

## Post-incident actions
- Conduct a post-incident review within 10 business days of closure.
- Update security controls, playbooks, and training as required.
- File all evidence (timelines, logs, communications) in the incident repository.

## References
- [Birchal Data Map](../apgms/docs/data-map.md)
- OAIC NDB resources: <https://www.oaic.gov.au/privacy/notifiable-data-breaches>
