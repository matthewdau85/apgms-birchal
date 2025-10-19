# Data Retention Policy

| Entity | Purpose | Retention Window | Disposition | Export & Deletion References |
| --- | --- | --- | --- | --- |
| Users | Authentication & authorisation | Life of customer relationship + 24 months | Scheduled purge of inactive records after window elapses | `scripts/export-users.ts` for export, `worker/src/jobs/user-delete.ts` for deletion |
| Organisations | Billing & compliance | Life of contract + 7 years | Archived to cold storage, removed from primary databases | `scripts/export-orgs.ts`, `infra/terraform/modules/storage` lifecycle rules |
| Bank Accounts | Payment routing | 7 years from closure | Secure erase of BSB/Account details; anonymise residual metadata | `services/api-gateway/src/tasks/export-bank-accounts.ts`, `worker/src/jobs/bank-account-delete.ts` |
| Bank Lines | Transaction history | 7 years from transaction date | Rolling purge job removing aged ledger entries | `scripts/export-bank-lines.ts`, `worker/src/jobs/bank-line-delete.ts` |
| API Tokens | Service access control | 90 days after revocation | Immediate revocation, purge from secrets store after timer | `services/api-gateway/src/tasks/export-api-tokens.ts`, `worker/src/jobs/token-delete.ts` |
| Audit Logs | Regulatory evidence | 7 years fixed | WORM storage until expiry, purge via compliance process | `infra/logs/export-audit-logs.md`, `worker/src/jobs/audit-log-retire.ts` |

## Deletion Timers

- **User & Organisation cleanup** runs nightly, identifying accounts past retention windows and enqueuing deletion jobs.
- **Financial data reaper** executes hourly, pruning bank account/line data whose retention period has expired.
- **Token sweeper** runs every 15 minutes to remove stale API tokens and invalidate cached credentials.

## Export & Erasure Requests

1. Submit request via privacy console to generate case ID.
2. Run corresponding export script to provide data bundle within 7 days.
3. Trigger deletion job referenced above, ensuring downstream caches are cleared.
4. Record completion in compliance tracker for audit evidence.
