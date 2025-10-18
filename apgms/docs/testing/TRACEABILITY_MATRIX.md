# Patent Traceability Matrix (Draft)

| Patent Claim ID | Feature / Capability | Implementing Services | Primary Tests | Observability Signals | Status |
| --- | --- | --- | --- | --- | --- |
| CLAIM-1 | Customer onboarding identity verification | `api-gateway`, `connectors/kyc`, `registries` | Playwright onboarding flow, contract tests for KYC API | Traces: `onboarding.*`; Metrics: `onboarding_success_total` | Pending mapping |
| CLAIM-2 | Real-time payment instruction orchestration | `payments`, `recon`, `tax-engine` | Integration tests for payment submission, k6 load tests | Metrics: `payment_latency_bucket`; Logs: `payment_id` correlation | Pending mapping |
| CLAIM-3 | Cross-jurisdiction tax compliance computation | `tax-engine`, `cdr`, `audit` | Unit tests for tax calculation rules, contract tests for audit feed | Traces: `tax_engine.compute`; Metrics: `tax_discrepancy_total` | Pending mapping |
| CLAIM-4 | Immutable audit trail with regulatory export | `audit`, `registries`, `sbr` | Contract tests for registry push, E2E export scenario | Logs: structured ledger entries; Metrics: `export_failure_total` | Pending mapping |
| CLAIM-5 | Adaptive connector framework for third-party APIs | `connectors/*`, `api-gateway` | Connector contract tests, integration harness with sandbox | Metrics: `connector_error_total`; Traces: `connector.call` | Pending mapping |

> **Action Needed:** For each claim, populate the exact feature references (JIRA IDs, spec links), enumerate the validating tests (unit, integration, E2E), and document the telemetry that proves compliance.
