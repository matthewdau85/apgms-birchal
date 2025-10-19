# Key Management Service (KMS) Policy

## Key Purposes and Scope
- **Root tenant key**: Encrypts and signs platform-wide regulatory proof tokens (RPTs), seeds service specific keys, and anchors the trust chain for investors, issuers, and regulators.
- **Service envelope keys**: Issue API credentials, encrypt application secrets, and sign audit events that originate from API Gateway, worker pipelines, and reconciliation engines.
- **Data protection keys**: Encrypt at-rest datasets (PostgreSQL, object storage exports) and sensitive artifacts such as banking line attachments and investor identity documents.
- **Operational break-glass keys**: Held in escrow for emergency access to production data paths when automated controls fail.

## Rotation Cadence
- Rotate root tenant key every **90 days**; publish new public key fingerprints to all downstream services and notify integration partners within 24 hours.
- Rotate service envelope keys every **60 days** or immediately upon detecting compromise, tenant rotation, or CI/CD secret exposure.
- Rotate data protection keys every **180 days**, leveraging envelope re-encryption to avoid plaintext exposure. Keys used for temporary exports must be rotated immediately after export expiration.
- Break-glass keys are sealed and rotated every **30 days** even if unused; validation that old packages are destroyed is required.

## Retention and Retirement
- Retain expired root and service keys for **365 days** to support forensic verification of historical RPT chains. Archive copies remain in an encrypted vault with dual control.
- Retain data protection keys until all ciphertext encrypted with that key has been re-keyed, then shred the key material using hardware-backed secure erase.
- Maintain an immutable ledger of key states (active, rotated, revoked, destroyed) with timestamps, approvers, and linked change tickets.
- On retirement, ensure dependent services confirm new key material before revoking old keys. Destroy private keys only after confirming backup restoration points are re-encrypted.

## Access Controls
- Enforce least privilege through IAM: only the SRE on-call rotation, security engineering, and the compliance officer role may access production KMS key material.
- Require hardware security tokens (FIDO2) plus TOTP for console access, and short-lived workload identities (≤15 minutes) for programmatic access.
- Log every KMS operation (generate, rotate, decrypt, sign) to the audit service with immutable storage and automated anomaly detection.
- All manual operations require dual authorization with recorded change approvals and Slack/Email notifications to compliance distribution lists.

## Backup, Restore, and Drills
- Run `scripts/backup.sh` nightly to capture the PostgreSQL state plus `artifacts/kms/*` material; store generated archives in tamper-evident storage.
- Validate restoration monthly by executing `scripts/restore.sh <archive>` into a staging environment, re-running Prisma migrations, and verifying `verifyChain` success on recent RPTs.
- Maintain off-site copies of the latest seven nightly backups plus weekly copies for three months; encrypt backup archives with a rotating object storage key.
- Document every drill (date, participants, outcome, follow-up actions) in the security runbook and remediate gaps within 5 business days.
