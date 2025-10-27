# APGMS Implementation Task Backlog

This backlog translates the patentability design dossier into actionable engineering work items. Each task includes a high-level goal, core deliverables, and validation pointers to guide implementation.

## 1. One-Way Tax Wallet & RPT Gatekeeper

### 1.1 Wallet Service Skeleton
- Scaffold a dedicated `wallet-gatekeeper` service within `services/payments`.
- Define inbound APIs for `MintDebitIntent`, `PresentRPT`, and `RevokeIntent` commands.
- Integrate shared telemetry & structured logging.

**Acceptance:** POSTMAN contract tests proving request validation and 200/400/409 paths.

### 1.2 Deterministic Debit Orchestration
- Implement idempotent debit execution guarded by RPT verification.
- Persist orchestration state keyed by `{mandate_id, period, nonce}`.
- Emit revocation events when compliance states mutate.

**Acceptance:** Unit tests covering idempotency, double-spend protection, and revocation dispatch.

### 1.3 RPT Validation Library
- Create a reusable library under `services/payments/libs/rpt`.
- Support signature verification, expiry checks, nonce replay cache, and payload schema validation.
- Provide helper to bind artefact digests and mandate posture to verification results.

**Acceptance:** Cryptographic test vectors plus fuzz-style schema validation tests.

## 2. Reconciliation Pass Token Lifecycle

### 2.1 Token Minting Pipeline
- Build a token minting microservice under `services/recon` that consumes artefacts and rule version identifiers.
- Calculate period digests (hash of artefact manifests) and assemble payload fields `{period, artefact_digest, rules_version, mandate_status, anomaly_posture, nonce, expiry}`.
- Sign tokens using existing KMS abstractions.

**Acceptance:** Integration tests verifying deterministic payloads for identical artefacts and signature validity under rotation.

### 2.2 Mutation-Driven Invalidation
- Implement watcher on reconciliation artefact stores that triggers RPT invalidation events.
- Maintain token registry that tracks active tokens and their associated digest fingerprints.
- On digest mismatch, broadcast revocation to wallet service and downgrade debit scopes.

**Acceptance:** Scenario tests showing automatic invalidation and forced re-reconciliation flows.

### 2.3 Manifest Emission & Audit Chain
- Extend `services/audit` to generate hash-linked manifests for registry validations, ingestion diffs, calculator outputs, bank matches, debit events, and BAS compilations.
- Ensure each manifest includes parent hash, timestamp, and signature for third-party verification.
- Provide API endpoint to retrieve manifest chain for a given period/mandate.

**Acceptance:** End-to-end test verifying manifest chain continuity and external verifier script sample.

## 3. Schedule Ingestion & Rule Diffing

### 3.1 ATO Schedule Parser
- Enhance `services/registries` with ingestion logic for ATO release feeds.
- Normalize schedule data into machine-readable rules version documents.
- Capture metadata: source digest, activation window, affected labels.

**Acceptance:** Parser unit tests across historical release samples; diff snapshot stored in fixtures.

### 3.2 Impact Preview Engine
- Implement diff comparator that highlights impacted periods and labels prior to activation.
- Provide scoring model that estimates reconciliation blast radius (number of mandates, outstanding tokens).
- Surface output via CLI tool for operator dry-run.

**Acceptance:** CLI golden-file tests and operator workflow documentation.

## 4. Anomaly-Aware Release Controller

### 4.1 Anomaly Signal Integration
- Connect existing anomaly detection hooks from `services/recon` to release controller.
- Configure throttle policies, dual-control requirements, and forced re-reconciliation triggers based on anomaly score bands.

**Acceptance:** Policy simulation tests demonstrating state transitions under varying anomaly postures.

### 4.2 Control Plane Dashboard Hooks
- Expose REST endpoints or message topics for control plane UI to surface anomaly-driven gate changes.
- Include audit logging of operator overrides and acknowledgement workflows.

**Acceptance:** API contract tests plus logging assertions ensuring override traceability.

## 5. Security & Verification Tooling

### 5.1 Replay Resistance Test Suite
- Develop automated suite that simulates nonce reuse, expired token submission, and signature tampering.
- Ensure wallet & recon services reject all malicious attempts with observable alerts.

**Acceptance:** Security regression tests integrated into CI.

### 5.2 Manifest Verifier CLI
- Provide standalone CLI that auditors can run to verify manifest chain integrity and token linkage.
- Include docs on key rotation handling and expected outputs for valid/invalid chains.

**Acceptance:** CLI unit tests plus doc-based validation walkthrough.

## 6. Benchmarking & Metrics

### 6.1 Baseline Metrics Collector
- Instrument reconciliation and debit pipelines to capture replay rate, reconciliation accuracy, time-to-lodgement, and dispute resolution duration.
- Store metrics in time-series DB with dashboards for pre/post comparisons.

**Acceptance:** Metrics smoke tests verifying pipeline ingestion and dashboard snapshots.

### 6.2 Prototype Gain Experiments
- Design experiment harness comparing legacy vs APGMS flows using synthetic workloads.
- Report measurable improvements in security and reliability metrics.

**Acceptance:** Experiment notebooks and summary report artefacts checked into repo.

---

These tasks can be refined into tickets with story points and dependencies as engineering planning progresses.
