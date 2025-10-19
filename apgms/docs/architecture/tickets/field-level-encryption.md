# Follow-up: field-level protection for sensitive identifiers

## Summary
Implement deterministic hashing or encryption for sensitive columns (starting with `User.email` and future authentication tokens) so they are not stored in plaintext while preserving the ability to perform equality lookups.

## Scope

* Add a dedicated key hierarchy using the platform KMS (envelope encryption per environment).
* Introduce Prisma middleware that hashes/encrypts before write and reverses (if needed) on read.
* Backfill existing data safely and migrate legacy clients.
* Update API contracts and validation to operate on hashed/encoded values where appropriate.
* Extend automated tests to assert redaction and reversible behaviour for authorised services.

## Dependencies

* Decision on KMS provider and rotation cadence.
* Alignment with compliance to ensure hashing/encryption aligns with audit expectations.

## Out of scope (for now)

* Searchable encryption for free-text fields.
* Re-encrypting historical backups (handled via retention policy in the interim).

## Acceptance criteria

1. Emails and similar identifiers are never stored nor logged in plaintext.
2. Operational tooling (support, reporting) continues to function with hashed lookups.
3. Documentation in `docs/architecture/data-governance.md` is updated with the final approach.
