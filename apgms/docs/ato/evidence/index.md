# Evidence Catalogue

| Artefact | Location | Description |
|----------|----------|-------------|
| Software Bill of Materials | `sbom.json` | Latest build SBOM exported from CI.
| Software Composition Analysis | `sca.json` | Dependency vulnerability findings with severity ratings.
| OTEL Telemetry Sample | `evidence/otel-*.json` | Span and metric snapshots for observability validation.
| Audit Log Sample | `artifacts/audit-sample.ndjson` | Immutable audit events with user/session metadata.
| AS4 Receipts | `artifacts/as4/` | Delivery receipts for secure message exchanges.
| Red Team Report | `reports/redteam/` | Offensive testing results and remediation tracking.
| Golden Path Report | `reports/golden/` | Positive control run demonstrating expected security posture.
