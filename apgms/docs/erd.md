# Data Model Overview

The platform uses PostgreSQL with Prisma ORM. The schema centres on organisations (`Org`), their users, bank activity, policies, gating events, and immutable audit trails. The following sections describe each entity and its relationships.

## Org
- **Fields:** `id`, `name`, `createdAt`.
- **Relationships:**
  - One-to-many with `User`, `BankLine`, `Policy`, `GateEvent`, `LedgerEntry`, `RptToken`, and `AuditBlob`.

## User
- **Fields:** `id`, `email`, `password`, `createdAt`, `orgId`.
- **Relationships:**
  - Many-to-one with `Org`.

## BankLine
- **Purpose:** Stores raw transaction data that downstream policies evaluate.
- **Fields:** `id`, `orgId`, `date`, `amount`, `payee`, `desc`, `createdAt`.
- **Relationships:**
  - Many-to-one with `Org`.

## Policy
- **Purpose:** Captures a versioned compliance or allocation policy for an organisation.
- **Fields:** `id`, `orgId`, `name`, `version`, `summary`, `config`, `createdAt`.
- **Relationships:**
  - Many-to-one with `Org`.
  - One-to-many with `AllocationRuleSet`, `GateEvent`, and `RptToken`.
  - Unique constraint on `(orgId, name, version)` provides simple policy versioning.

## AllocationRuleSet
- **Purpose:** JSON definition of allocation rules tied to a policy.
- **Fields:** `id`, `policyId`, `name`, `definition`, `createdAt`.
- **Relationships:**
  - Many-to-one with `Policy`.
  - One-to-many with `GateEvent` and `RptToken`.

## GateEvent
- **Purpose:** Immutable events emitted while evaluating gates or policies.
- **Fields:** `id`, `orgId`, `policyId`, `allocationRuleSetId`, `requestId`, `eventType`, `payload`, `prevEventId`, `prevHash`, `hash`, `createdAt`.
- **Relationships:**
  - Many-to-one with `Org`, `Policy`, and optionally `AllocationRuleSet`.
  - Self-referencing `prevEventId` forms a rolling hash chain per organisation; the combination of `prevEventId`, `prevHash`, and `hash` establishes tamper evidence.
  - One-to-many with `LedgerEntry`, `RptToken`, and `AuditBlob`.
  - `requestId` is unique to prevent duplicate processing.

## LedgerEntry
- **Purpose:** Immutable financial postings aligned with gate evaluations.
- **Fields:** `id`, `orgId`, `gateEventId`, `requestId`, `entryType`, `amount`, `currency`, `memo`, `prevEntryId`, `prevHash`, `hash`, `createdAt`.
- **Relationships:**
  - Many-to-one with `Org` and optionally `GateEvent`.
  - Self-referencing `prevEntryId` plus the hash fields produce a rolling hash chain for ledger integrity.
  - One-to-many with `AuditBlob`.
  - `requestId` is unique for deduplication.

## RptToken
- **Purpose:** Represents issued or revoked RPT (Restricted Policy Token) artefacts.
- **Fields:** `id`, `orgId`, `policyId`, `allocationRuleSetId`, `gateEventId`, `requestId`, `token`, `status`, `issuedAt`, `expiresAt`, `metadata`.
- **Relationships:**
  - Many-to-one with `Org`, `Policy`, and optionally `AllocationRuleSet` and `GateEvent`.
  - Each token enforces unique `requestId` and `token` values.

## AuditBlob
- **Purpose:** Write-once immutable audit attachments (WORM storage).
- **Fields:** `id`, `orgId`, `gateEventId`, `ledgerEntryId`, `requestId`, `content`, `contentType`, `prevBlobId`, `prevHash`, `hash`, `createdAt`.
- **Relationships:**
  - Many-to-one with `Org` and optionally `GateEvent`/`LedgerEntry`.
  - Self-referencing `prevBlobId` and the rolling hash chain guard against mutation.
  - `requestId` is unique to match upstream calls.

## Hash Chains and Request Identifiers
- `GateEvent`, `LedgerEntry`, and `AuditBlob` implement rolling hash chains. Each record stores the previous record's ID and hash, alongside its own hash, enabling verification without soft deletes.
- `GateEvent`, `LedgerEntry`, `RptToken`, and `AuditBlob` enforce unique `requestId` values so that every ingest request is processed exactly once.

These entities provide the foundation for policy evaluation, gating, financial reconciliation, RPT issuance, and immutable audit evidence across the demo organisation.
