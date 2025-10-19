# QuickBooks Online Supplier Record

## Vendor Overview
- **Vendor Name:** Intuit Inc.
- **Connector Category:** Accounting
- **Primary Contacts:**
  - Security: security@intuit.com
  - Account Management: qb-enterprise@intuit.com
- **Data Exchanged:** General ledger entries, invoice metadata, account balances
- **Authentication Mode:** OAuth 2.0
- **Risk Rating:** Medium

## Compliance Attestations
- **SOC 2 Type II (Date / Status):** January 2024 – In force
- **ISO 27001 (Date / Status):** Certified 2023 – Surveillance audits ongoing
- **Additional Certifications:** PCI DSS compliance for payment modules

## Data Protection
- **Data Processing Agreement (DPA) Status:** Executed 2023-02-10
- **Subprocessor Review:** Reviewed semi-annually; vendor list stored in compliance share
- **Encryption & Key Management Summary:** TLS 1.2+ in transit; AES-256 with Intuit-managed KMS at rest

## Operational Controls
- **Monitoring & Alerting Integrations:** API ingestion completeness dashboards; anomaly detection for journal variance
- **Compensating Controls:** Dual approval for journal imports, daily automated GL variance checks
- **Access Review Cadence:** Semi-annual access certification

## Incident Response
- **Incident Notification SLA:** 48 hours from confirmation
- **Escalation Contacts:** security@intuit.com; (650) 944-6000
- **Breach Communication Flow:** Intuit security notifies APGMS security; APGMS coordinates finance and legal stakeholder updates

## Notes
- **Outstanding Risks / Exceptions:** Dependency on Intuit status notifications for outage awareness
- **Planned Remediation:** Integrate third-party availability monitoring for API endpoints
