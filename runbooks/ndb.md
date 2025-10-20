# Notifiable Data Breach (NDB) Runbook

This runbook describes the steps to assess, contain, and report eligible data breaches under the Australian OAIC Notifiable Data Breaches scheme.

## 1. Detection & Initial Response (Day 0)
1. **Trigger:** Security alert, customer report, or internal observation indicating potential personal data exposure.
2. **Assemble response team:** Incident commander (Security Lead), Legal counsel, Privacy officer, Communications lead, Engineering representative.
3. **Containment:** Isolate affected systems, revoke exposed credentials, enable additional monitoring, preserve forensic evidence.
4. **Logging:** Open incident ticket in OpsGenie with severity, initial scope, and timestamp to start the 30-day assessment timer.

## 2. Assessment (Day 0-30)
1. **Identify breached data:** Determine what personal information was involved and the number of individuals affected.
2. **Risk evaluation:** Assess likelihood of serious harm considering sensitivity, security controls, and possible misuse.
3. **Decision checkpoint:** Privacy officer and Legal counsel must decide if the incident is an *eligible data breach* within 30 calendar days of detection. Document rationale in the incident ticket.
4. **OAIC notification preparation:** If eligible, draft the statement for the OAIC including description, kinds of information, and steps taken. Use the template in [Appendix A](#appendix-a-oaic-notification-template).

## 3. Notification & Communication (If eligible)
1. **OAIC submission:** Lodge the statement via OAIC's Notifiable Data Breach form without undue delay once eligibility is confirmed.
2. **Affected individuals:** Use [Appendix B](#appendix-b-customer-notification-template) to notify individuals via email or secure portal. Notifications must describe the breach, recommended actions, and contact details.
3. **Partners and regulators:** Inform impacted partners and, if applicable, APRA or ASIC liaison contacts.

## 4. Post-Incident Review
1. **Lessons learned workshop** within 14 days of closure to document control improvements.
2. **Control remediation plan** tracked in the risk register with accountable owners and due dates.
3. **Update evidence**: File OAIC submission, communications, and post-mortem in the compliance repository.

## Appendix A: OAIC Notification Template
```
Subject: Notifiable Data Breach Statement - <Incident Name>

1. Organisation Details
   - Entity name: APGMS Birchal Pty Ltd
   - Contact: privacy@apgms.example

2. Incident Summary
   - Date detected: <DD MMM YYYY>
   - Incident description: <Concise narrative>
   - Containment actions: <Steps taken>

3. Personal Information Involved
   - Categories: <e.g. identification, financial, credentials>
   - Number of individuals: <Estimated count>

4. Assessment of Serious Harm
   - Likelihood and consequences analysis.

5. Steps Taken / Planned
   - Mitigation actions and support offered to individuals.

6. Notifications to Individuals
   - Method and timing of notifications.

7. Contact for OAIC
   - Name, role, phone, and email.
```

## Appendix B: Customer Notification Template
```
Subject: Important information about your personal data

Hello <Customer Name>,

We recently discovered a security incident that may have involved some of your personal information. Our investigation confirmed the following:
- What happened: <Plain-language summary>
- Information involved: <Specific data>
- When it occurred: <Date range>

We have taken immediate steps to contain the issue and have reported the matter to the Office of the Australian Information Commissioner (OAIC).

### What you can do
- <Recommended protective steps>

We are here to help. Contact us at privacy@apgms.example or 1300 000 000.

Thank you,
APGMS Birchal Privacy Team
```

