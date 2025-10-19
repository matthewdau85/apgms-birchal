# Gusto Payroll Supplier Record

## Vendor Overview
- **Vendor Name:** Gusto, Inc.
- **Connector Category:** Payroll
- **Primary Contacts:**
  - Security: security@gusto.com
  - Account Management: customer-success@gusto.com
- **Data Exchanged:** Employee roster, payroll run summaries, tax filing confirmations
- **Authentication Mode:** OAuth 2.0
- **Risk Rating:** Medium

## Compliance Attestations
- **SOC 2 Type II (Date / Status):** February 2024 – In force
- **ISO 27001 (Date / Status):** Not certified
- **Additional Certifications:** N/A

## Data Protection
- **Data Processing Agreement (DPA) Status:** Executed 2022-12-05
- **Subprocessor Review:** Documented in annual payroll compliance review
- **Encryption & Key Management Summary:** TLS 1.2+ in transit, AES-256 in managed cloud KMS

## Operational Controls
- **Monitoring & Alerting Integrations:** Payroll run ingestion monitored for completeness; exception alerts to payroll ops
- **Compensating Controls:** Segregation of duties for payroll approvals, MFA enforced for connector administrators
- **Access Review Cadence:** Quarterly access review and payroll exception sampling

## Incident Response
- **Incident Notification SLA:** 24 hours from detection
- **Escalation Contacts:** security-incident@gusto.com; (844) 650-2040
- **Breach Communication Flow:** Gusto notifies APGMS security and payroll ops; APGMS coordinates HR and legal response playbooks

## Notes
- **Outstanding Risks / Exceptions:** Dependence on vendor uptime during payroll deadlines
- **Planned Remediation:** Implement backup payroll file export as contingency
