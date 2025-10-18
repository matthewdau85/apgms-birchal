# Entity-Relationship Diagram

## Current entities

### Org
- **Table**: `Org`
- **Primary key**: `id` (string, `cuid()`)
- **Attributes**: `name` (string), `createdAt` (timestamp default `now()`)
- **Relations**:
  - One-to-many with `User` via `Org.id` → `User.orgId` (cascade delete).
  - One-to-many with `BankLine` via `Org.id` → `BankLine.orgId` (cascade delete).

### User
- **Table**: `User`
- **Primary key**: `id` (string, `cuid()`)
- **Attributes**: `email` (unique string), `password` (string), `createdAt` (timestamp default `now()`), `orgId` (string FK).
- **Relations**: Many-to-one to `Org`.

### BankLine
- **Table**: `BankLine`
- **Primary key**: `id` (string, `cuid()`)
- **Attributes**: `orgId` (string FK), `date` (timestamp), `amount` (decimal), `payee` (string), `desc` (string), `createdAt` (timestamp default `now()`).
- **Relations**: Many-to-one to `Org`.

## Missing domains
The repository has no schema definitions or migrations for the requested domains below. Each item requires a new model/table design, migrations, and related repositories/services.

- **POLICY**: TBD — no existing models reference policy management.
- **GATE**: TBD — no existing models define gateway/entitlement data.
- **LEDGER**: TBD — no general ledger tables exist beyond `BankLine` placeholders.
- **RPT**: TBD — no reporting tables or materialized views are present.
- **AUDIT_BLOB**: TBD — no blob storage or audit trail tables are implemented.
