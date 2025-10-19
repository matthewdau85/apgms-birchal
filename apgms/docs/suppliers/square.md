# Square POS Supplier Record

## Vendor Overview
- **Vendor Name:** Square, Inc.
- **Connector Category:** POS
- **Primary Contacts:**
  - Security: security@squareup.com
  - Account Management: enterprise@squareup.com
- **Data Exchanged:** Transaction totals, payment method metadata, location identifiers
- **Authentication Mode:** OAuth 2.0
- **Risk Rating:** Medium

## Compliance Attestations
- **SOC 2 Type II (Date / Status):** March 2024 – In force
- **ISO 27001 (Date / Status):** Certified 2023 – Annual surveillance audits
- **Additional Certifications:** PCI DSS Level 1

## Data Protection
- **Data Processing Agreement (DPA) Status:** Executed 2023-08-15
- **Subprocessor Review:** Annual review maintained in vendor portal
- **Encryption & Key Management Summary:** TLS 1.2+ in transit, AES-256 at rest with HSM-backed keys

## Operational Controls
- **Monitoring & Alerting Integrations:** Webhook delivery monitored with retry analytics; APGMS alerting for reconciliation mismatches
- **Compensating Controls:** Daily settlement reconciliation, webhook signature validation
- **Access Review Cadence:** Quarterly connector access reviews

## Incident Response
- **Incident Notification SLA:** 24 hours from confirmation
- **Escalation Contacts:** security-incident@squareup.com; hotline +1-855-700-6000
- **Breach Communication Flow:** Square notifies APGMS security lead, who coordinates internal response and customer communication

## Notes
- **Outstanding Risks / Exceptions:** Dependency on webhook delivery requires redundant monitoring
- **Planned Remediation:** Evaluate redundant data pulls for critical settlement windows
