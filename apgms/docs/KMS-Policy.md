# APGMS KMS Policy

## Key Aliases
- `rpt-signing`: signs Regulatory Proof Tokens (RPTs) issued by the platform.
- `rpt-audit`: encrypts and decrypts audit logs related to RPT issuance.
- `ops-breakglass`: emergency key used only for disaster recovery of the signing hierarchy.

## Rotation Cadence
- All production keys rotate every **90 days**.
- Rotation windows are scheduled at least one week in advance and executed during the Tuesday maintenance window.
- Non-production environments follow the same cadence but may batch rotate multiple aliases on the same day.

## Approval Workflow
1. Key custodian opens a change ticket specifying alias, planned rotation date, and validation steps.
2. Security operations reviews the ticket and provides written approval.
3. Dual control is enforced: one engineer performs the rotation while a second reviewer observes and signs off in the ticket.
4. Post-rotation validation includes updating dependent services with the new key material and confirming successful signature verification.

## Recovery Procedures
- Key artifacts generated during rotation are stored under `artifacts/kms/` and backed up via the `scripts/backup-kms.sh` procedure.
- Disaster recovery uses `scripts/restore-kms.sh` to restore the most recent tarball into the runtime `artifacts/kms/` directory.
- The `ops-breakglass` alias remains sealed in an offline vault. Access requires approval from both the CISO and the head of engineering.
- After recovery, services must re-run health checks to ensure signature validation succeeds with the restored material.

## Audit Requirements
- Every rotation event appends a JSON record that includes alias, timestamp, version, and checksum of the generated key material.
- Rotation and recovery tickets are retained for at least 24 months.
- Weekly audit scripts compare the list of expected aliases with the actual artifacts in `artifacts/kms/` to detect drift.
- The backup/restore drill in CI verifies that RPT chains remain valid after a full restore and serves as an automated control for this policy.
