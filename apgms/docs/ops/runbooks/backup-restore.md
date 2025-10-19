# Backup & Restore Runbook

**Objective:** Restore the production Postgres database from the nightly encrypted backup while preserving audit integrity.

## Preconditions

- PagerDuty incident `DB-BACKUP-RESTORE` is active.
- Access to the AWS account with the `dba` role.
- Latest backup object key from the BackupVault SNS notification.

## Procedure

1. Announce maintenance window in #prod-alerts and create a Zoom bridge.
2. Put the API Gateway in maintenance mode by disabling the Kubernetes ingress.
3. Trigger a manual snapshot of the replica for contingency.
4. Restore the backup to a new RDS instance using the documented parameter group.
5. Run the smoke tests: `pnpm --filter @apgms/api-gateway db:smoke`.
6. Point the Prisma connection string to the restored instance and deploy the config change.
7. Re-enable ingress and monitor the `/ready` endpoint until healthy.
8. Close the incident with a summary referencing the Grafana dashboard links.

## Validation

- Compare row counts between the restored DB and snapshot (within 0.5% variance).
- Confirm `AuditEvent` continuity by verifying there are no timestamp gaps longer than 5 minutes.
- Run privacy export to ensure customer data is intact.

## Post-Incident

- Update this runbook with lessons learned.
- File follow-up Jira tasks for automation gaps within two business days.
