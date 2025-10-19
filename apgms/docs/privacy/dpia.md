# DPIA

## Admin controls
- `POST /admin/export/:orgId` → JSON bundle persisted to `services/api-gateway/exports`
- `POST /admin/delete/:orgId` → sets `Org.deletedAt` + `Org.piiRedactedAt`

## Scheduled jobs
- `worker/src/jobs/redact.ts` enforces `RETENTION_DAYS_PII`
