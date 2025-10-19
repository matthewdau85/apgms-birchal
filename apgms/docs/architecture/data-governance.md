# Data governance

This document describes how we manage retention and privacy for structured data that flows through the platform. The scope covers the primary tables defined in `shared/prisma/schema.prisma` and the operational data that backs the API gateway.

## Data retention

| Dataset | Purpose | Retention policy |
| --- | --- | --- |
| `Org` records | Tenant bootstrap and authorisation | Retained indefinitely while the organisation is an active customer. Soft-delete logic is planned for off-boarding; backups honour the same policy. |
| `User` records | Account provisioning and audit | Retained while the owning organisation is active. Accounts are disabled after 90 days of inactivity and deleted 30 days after deactivation. |
| `BankLine` records | Transaction history ingest and reconciliation | Retained for seven (7) years to satisfy statutory audit expectations. Older rows are archived to cold storage with the same protection guarantees. |

Backups inherit the above timeframes and are encrypted by the underlying database service. Restore requests are restricted to the platform SRE rotation and must be approved through the incident workflow.

## PII handling and access controls

* PII (email addresses, transaction metadata) is only available to services with an explicit need-to-know. Prisma client access is centralised in `shared/src/db.ts` to ensure future cross-cutting controls can be applied in one place.
* Runtime secrets such as `DATABASE_URL` are injected through the deployment environment, never committed to the repository, and rotated quarterly.
* Application logs are redacted by default via Fastify/Pino redaction so that emails, tokens and passwords are masked before emission.

## Encryption expectations

* **In transit:** All traffic terminates behind managed TLS. Internal service-to-service communication must also negotiate TLS (mTLS for production clusters).
* **At rest:** PostgreSQL storage relies on the cloud provider's disk encryption (AES-256). Prisma connections should enforce `sslmode=require` (production) to guarantee encrypted links.
* **Secrets at rest:** Deployment credentials live in the platform secret manager with audit logging enabled. Local development uses `.env` files stored outside of version control.

## Field-level encryption and hashing

We evaluated Prisma client middleware and column-level encryption for `User.email`, potential authentication tokens and other identifiers. Implementing deterministic hashing/encryption would require:

1. Introducing a key management pattern (KMS envelope keys with rotation semantics).
2. Applying Prisma middleware (or database native encryption) to transparently hash/encrypt on write and decrypt on read.
3. Updating query patterns (e.g. lookups by email) to use hashed columns or secure search indexes.

The work is outside the current MVP scope but is critical for hardening before launch.

### Follow-up ticket

See `docs/architecture/tickets/field-level-encryption.md` for the implementation plan that should be scheduled once the MVP stabilises.
