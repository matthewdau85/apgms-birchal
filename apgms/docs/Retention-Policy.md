# Data Retention Policy

This document outlines the retention requirements for data classes handled by APGMS. Retention timers start from the `createdAt` timestamp unless otherwise stated.

| Data Class | Examples | Retention Window | Rationale |
| ---------- | -------- | ---------------- | --------- |
| Operational Logs | HTTP request logs, application diagnostics | 30 days | Support debugging and availability triage while limiting exposure of transient PII. |
| Audit Trail (FIN/PII) | `AuditLog` records describing user and system actions | 7 years | Regulatory obligations for financial systems and dispute investigation. |
| Financial Artifacts | `BankLine`, reconciliation exports, ledger snapshots | 7 years | Aligns with AU tax guidance for financial records. |
| Blob Storage Artifacts | `BlobObject` metadata for exported files or reports | 180 days | Ensure large files are rotated after distribution obligations complete. |
| User Authentication Data | Password hashes, active session tokens | 90 days after user deletion | Allow security incident response while minimizing risk. |

## Purge Behaviour

The purge worker enforces the policy by deleting records older than the configured window. Dry-run mode provides counts without mutating storage to support auditing changes to the schedule.

| Target | Window | Implementation Notes |
| ------ | ------ | ------------------- |
| `prisma.auditLog` | 7 years | `createdAt` field is used to determine age. |
| `prisma.blobObject` | 180 days | Removes metadata for orphaned blobs; downstream storage GC handles actual objects. |
| `prisma.appLog` | 30 days | Backed by operational logging store; only metadata is retained for short-term diagnostics. |

All deletions are logged through the redacting logger to avoid leaking PII during enforcement operations.
