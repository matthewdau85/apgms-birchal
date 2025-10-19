# Supplier Risk Overview

The following table summarizes the current point-of-sale (POS), payroll, and accounting connectors integrated with APGMS. Each entry outlines the core data exchanges, authentication mechanisms, inherent risk rating, and compensating controls used to mitigate supplier risk.

| Connector | Category | Data Exchanged | Authentication Mode | Risk Rating | Compensating Controls |
| --- | --- | --- | --- | --- | --- |
| Square POS | POS | Transaction totals, payment method metadata, location identifiers | OAuth 2.0 | Medium | Daily reconciliation alerts, access reviews, webhook integrity monitoring |
| Gusto Payroll | Payroll | Employee roster, payroll runs, tax remittance confirmations | OAuth 2.0 | Medium | Quarterly entitlement recertification, encryption in transit and at rest |
| QuickBooks Online | Accounting | General ledger entries, invoice metadata, account balances | OAuth 2.0 | Medium | Dual-authorization for configuration changes, anomaly detection on journal imports |

All connectors inherit APGMS baseline controls, including centralized logging, least-privilege access, and incident response integration.
