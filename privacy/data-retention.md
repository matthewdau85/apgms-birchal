# Data Retention Schedule

This schedule defines authoritative retention requirements for systems processing personal and financial data.

| Dataset / System | Retention Duration | Notes |
| --- | --- | --- |
| CRM (Customer profiles, contact history) | 7 years from account closure | Supports customer enquiries and statutory record-keeping obligations. |
| AuditBlob / RPT logs | 7 years rolling | Required to demonstrate compliance with CDR and SOC2 evidence obligations. |
| Payments settlement records | 7 years from transaction date | Aligns with AU taxation documentation requirements. |
| Tax Engine TFN cache | Current financial year + 4 years | Ensures TFNs are purged when no longer required for active assessments. |
| Support platform conversations | 3 years from last interaction | Maintains historical context while minimising stored PII. |
| Analytics telemetry | 13 months from collection | Aggregated prior to long-term storage to reduce re-identification risk. |
| Marketing consents | Until withdrawn or 2 years after inactivity | Periodic reconfirmation ensures compliance with consent requirements. |
| Backup archives | 35 days rolling | Automated purge schedule applied to encrypted backups. |

Review this schedule annually or when regulatory drivers change.
