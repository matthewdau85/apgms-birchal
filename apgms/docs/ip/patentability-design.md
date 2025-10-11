# APGMS Patentability Design Dossier

## 1. Technical Problem & Solution Overview
- **Problem:** Traditional BAS/PAYGW platforms lack deterministic, verifiable controls that bind compliance artefacts to payment execution, leaving room for fund diversion, replay attacks, and inconsistent lodgement states.
- **Solution:** APGMS introduces a cryptographically bound, one-way funds control architecture that gates debit and lodgement operations on reconciliation evidence encoded within short-lived Reconciliation Pass Tokens (RPTs).

## 2. Core Inventive Concepts
1. **One-Way Tax Wallet with Deterministic Gates**
   - Funds can only move outward when a valid RPT is presented.
   - Debit orchestration is idempotent and includes revocation logic when compliance state changes.
2. **Reconciliation Pass Token (RPT) Interlock**
   - Token payload binds `{period, artefact digest, rules version, mandate status, anomaly posture}`.
   - Non-replayable through nonce, expiry, and signature chaining.
3. **Deterministic Audit Chain**
   - Hash-linked manifests cover registry validations, ingestion diffs, calculator versions, bank matches, debit events, and BAS compilations.
   - Designed for third-party verification (ATO, banks, auditors).
4. **Schedule Ingestion / Diff / Dry-Run Pipeline**
   - Converts ATO releases into machine-readable rule versions.
   - Provides an impact preview so operators see affected periods/labels before activation.
5. **Anomaly-Aware Release Controller**
   - Inline anomaly hooks trigger debit throttles, dual control, or forced re-reconciliation prior to gate transitions.

## 3. Claimable Method Workflow (High-Level)
1. Receive artefacts (registry proofs, reconciliation matches, calculator outputs) tagged with rule-version identifiers.
2. Compute a period digest and mint an RPT encapsulating compliance state and mandate posture.
3. Enforce wallet release by verifying presented RPTs against current artefact digests and mandate state.
4. Detect artefact mutation → automatically invalidate prior RPTs, downgrade debit scopes, and require new reconciliation.
5. Emit signed manifests that external parties can verify to validate the debit/lodgement context.

## 4. Enablement Package Checklist
- **Figures:**
  - Sequence diagrams: onboarding → registry proofing → reconciliation → RPT mint → gated debit → BAS compile.
  - Component diagrams: ingestor, rules engine, token service, gatekeeper, anomaly controller, manifest generator.
- **Data Structures:**
  - RPT schema (fields, expiry semantics, signature method).
  - Manifest format with hash chaining strategy.
  - Rules-version metadata (source digest, activation window, affected labels).
- **Algorithms/Pseudocode:**
  - Gate verification routine (including idempotency keys & replay-safe webhooks).
  - Schedule diff parser and impact preview scoring.
  - Anomaly scoring adjustment to debit limits/dual control triggers.
- **Benchmarks:**
  - Replay/duplicate debit reduction.
  - Reconciliation accuracy vs baseline tools.
  - Time-to-lodgement and audit dispute resolution improvements.
- **Security Proof Points:**
  - Replay resistance analysis (token expiry, nonce, signature).
  - Tamper detection thresholds and invalidation timing.
  - Key rotation and manifest verification procedures.

## 5. Claim Strategy Notes by Jurisdiction
- **Australia:** Emphasise architecture preventing misdirection of funds and ensuring verifiable state at debit/lodgement time.
- **United States:** Highlight improvements to computer security and payment reliability via non-replayable gating and deterministic state binding.
- **Europe:** Focus on further technical effect—reduced settlement risk, enforced payment protocol changes, and automated security posture adjustments.

## 6. Follow-On IP Actions
1. Draft AU provisional incorporating the enablement package; keep UI narrative minimal.
2. Commission prior art search targeting escrow-style compliance-gated payment systems and audit tokens as preconditions.
3. Decide trade-secret boundaries (anomaly thresholds, reconciliation heuristics) before filing.
4. Develop prototype metrics to demonstrate measurable security/reliability gains.
5. Prepare system and computer-program-product claim sets mirroring the method workflow.
