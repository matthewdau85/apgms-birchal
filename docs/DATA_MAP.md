# API Data Map

This document maps the primary API surfaces to the data they expose, including
classification, storage, retention, and encryption practices.

## `/users`

| Field | Description | PII / Tax Classification | Storage Location | Retention | Encryption (At Rest / In Transit) |
| --- | --- | --- | --- | --- | --- |
| `id` | System-generated UUID | Non-PII | PostgreSQL `users.id` | Permanent | AES-256 (RDS) / TLS 1.2 |
| `email` | Login and contact email | Direct PII | PostgreSQL `users.email` | Until account deletion + 30 days | AES-256 (RDS) / TLS 1.2 |
| `full_name` | Legal name | Direct PII | PostgreSQL `users.profile` | Until account deletion + 7 years (reg. requirement) | AES-256 (RDS) / TLS 1.2 |
| `phone` | MFA and contact number | Direct PII | PostgreSQL `users.profile` | Until account deletion + 30 days | AES-256 (RDS) / TLS 1.2 |
| `tax_id` | Tax file number / EIN | Sensitive Tax | Vault-backed PostgreSQL column `users.tax_payload` | 7 years from last filing | AES-256 (RDS & HSM envelope) / TLS 1.2 |
| `created_at`, `updated_at` | Timestamps | Non-PII | PostgreSQL `users` | Permanent | AES-256 (RDS) / TLS 1.2 |

## `/bank-lines`

| Field | Description | PII / Tax Classification | Storage Location | Retention | Encryption (At Rest / In Transit) |
| --- | --- | --- | --- | --- | --- |
| `id` | Bank line identifier | Non-PII | PostgreSQL `bank_lines.id` | Permanent | AES-256 (RDS) / TLS 1.2 |
| `user_id` | Link to user | Indirect PII | PostgreSQL `bank_lines.user_id` | Matches `/users` retention | AES-256 (RDS) / TLS 1.2 |
| `institution_name` | Financial institution label | Non-PII | PostgreSQL `bank_lines.institution` | Permanent | AES-256 (RDS) / TLS 1.2 |
| `account_mask` | Masked account number (last 4) | Financial PII (masked) | PostgreSQL `bank_lines.account_mask` | Matches `/users` retention | AES-256 (RDS) / TLS 1.2 |
| `routing_number` | ACH routing | Financial PII | Secrets Manager (primary), replicated to PostgreSQL via view | Active + 2 years post closure | AES-256 (Secrets Manager) / TLS 1.2 |
| `status` | Connection state | Non-PII | PostgreSQL `bank_lines.status` | Permanent | AES-256 (RDS) / TLS 1.2 |

## `/allocations.*`

Routes under `/allocations` include `/allocations`, `/allocations/:id`, and `/allocations/:id/transactions`.

| Field | Description | PII / Tax Classification | Storage Location | Retention | Encryption (At Rest / In Transit) |
| --- | --- | --- | --- | --- | --- |
| `id` | Allocation identifier | Non-PII | PostgreSQL `allocations.id` | Permanent | AES-256 (RDS) / TLS 1.2 |
| `user_id` | Owner link | Indirect PII | PostgreSQL `allocations.user_id` | Matches `/users` retention | AES-256 (RDS) / TLS 1.2 |
| `amount` | Allocated amount | Financial Data | PostgreSQL `allocations.amount` | 7 years from allocation close | AES-256 (RDS) / TLS 1.2 |
| `currency` | ISO-4217 currency | Non-PII | PostgreSQL `allocations.currency` | Permanent | AES-256 (RDS) / TLS 1.2 |
| `tax_profile_id` | Link to tax profile | Sensitive Tax | PostgreSQL `tax_profiles.id` | 7 years from allocation close | AES-256 (RDS) / TLS 1.2 |
| `transactions[].document_blob` | Supporting documents | Financial PII (documents) | S3 `s3://rpt-blobs/allocations/` | 7 years from transaction | SSE-S3 (AES-256) / TLS 1.2 |
| `metadata` | Free-form JSON | May contain PII (customer supplied) | PostgreSQL `allocations.metadata` | Customer configurable (default 2 years) | AES-256 (RDS) / TLS 1.2 |

## `/audit/rpt/:id`

| Field | Description | PII / Tax Classification | Storage Location | Retention | Encryption (At Rest / In Transit) |
| --- | --- | --- | --- | --- | --- |
| `id` | Audit record identifier | Non-PII | PostgreSQL `audit_rpt.id` | Permanent | AES-256 (RDS) / TLS 1.2 |
| `actor_user_id` | User who triggered event | Indirect PII | PostgreSQL `audit_rpt.actor_user_id` | 7 years | AES-256 (RDS) / TLS 1.2 |
| `event_type` | Audit event type | Non-PII | PostgreSQL `audit_rpt.event_type` | 7 years | AES-256 (RDS) / TLS 1.2 |
| `event_payload` | Event metadata | May contain PII | PostgreSQL `audit_rpt.payload` | 7 years | AES-256 (RDS) / TLS 1.2 |
| `rpt_blob_uri` | Link to artifact | Financial / PII depending on source | S3 `s3://rpt-blobs/audit/<id>.json` | 7 years | SSE-S3 (AES-256) / TLS 1.2 |

## `webhooks`

Webhook payloads vary by topic. General classifications are below.

| Field | Description | PII / Tax Classification | Storage Location | Retention | Encryption (At Rest / In Transit) |
| --- | --- | --- | --- | --- | --- |
| `id` | Delivery attempt identifier | Non-PII | PostgreSQL `webhook_deliveries.id` | 30 days | AES-256 (RDS) / TLS 1.2 |
| `topic` | Event topic | Non-PII | PostgreSQL `webhook_deliveries.topic` | 30 days | AES-256 (RDS) / TLS 1.2 |
| `payload` | JSON payload | Topic dependent (may include PII) | PostgreSQL `webhook_deliveries.payload` + S3 `s3://rpt-blobs/webhooks/` (for payloads >128KB) | 30 days (DB) / 90 days (S3 archive) | AES-256 (RDS & SSE-S3) / TLS 1.2 |
| `headers` | Delivery metadata | Non-PII | PostgreSQL `webhook_deliveries.headers` | 30 days | AES-256 (RDS) / TLS 1.2 |
| `response_code` | Receiver response | Non-PII | PostgreSQL `webhook_deliveries.response_code` | 30 days | AES-256 (RDS) / TLS 1.2 |

RPT blob URIs reference immutable audit artifacts stored under
`s3://rpt-blobs/`, which are encrypted at rest with AWS-managed keys and served
over TLS during retrieval.

