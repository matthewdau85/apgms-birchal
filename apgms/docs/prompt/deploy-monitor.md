# Deployment and Monitoring Rules

## Prompt Versioning
- Use Semantic Versioning (`MAJOR.MINOR.PATCH`) for all prompt artifacts.
- Increment the **MAJOR** version when backward-incompatible schema or behavioral changes are introduced.
- Increment the **MINOR** version for backward-compatible feature additions, telemetry expansions, or canary configuration changes.
- Increment the **PATCH** version for hotfixes, typo corrections, or monitoring/alerting tuning that does not alter functionality.
- Record every release in the prompt changelog, including version, deployment window, and approval signatures.

## Canary Rollouts
- Deploy each new prompt version to a **5–10%** canary segment before global rollout.
- Maintain the canary for at least one full user-behavior cycle (minimum 24 hours) to capture traffic variance.
- Ensure canary traffic mirrors production mix across user personas, locales, and workload types.
- Require on-call ownership and automated alert routing during the canary window.

## Rollback Triggers
Initiate an immediate rollback if any of the following thresholds are breached relative to the previous stable release:

- **Schema quality score** decreases by **≥ 2 points**.
- **Pass rate** (task success/QA pass) decreases by **≥ 3 percentage points**.
- **p95 latency** increases by **≥ 30%**.

When a rollback is triggered, freeze further deployments until a root-cause analysis (RCA) is completed and mitigations are documented.

## Telemetry Logging Requirements
Log the following fields for every prompt execution and persist them for at least 90 days:

| Field | Description |
| --- | --- |
| `prompt_version` | Semantic version string of the deployed prompt. |
| `deployment_environment` | Environment identifier (canary, production, staging). |
| `request_id` | Unique identifier correlating user requests across services. |
| `user_segment` | Segment label (persona, locale, compliance tier). |
| `timestamp_utc` | ISO-8601 UTC timestamp of prompt execution. |
| `schema_score` | Latest schema validation score. |
| `pass_rate_window` | Rolling pass metric for the relevant evaluation window. |
| `latency_ms` | End-to-end latency in milliseconds. |
| `error_code` | Structured failure or policy violation code; `NULL` if successful. |
| `canary_flag` | Boolean flag indicating canary participation. |

Include references to the associated CI artifacts (see [`sample-dashboard.json`](./sample-dashboard.json)) in all telemetry records for downstream analysis.

## Dashboard & Alerting
- Publish deployment and monitoring metrics to a centralized dashboard sourced from CI artifact ingestion.
- Display real-time schema score, pass rate, and latency trends with canary vs. baseline comparisons.
- Configure alerts aligned with the rollback thresholds and route to the responsible on-call rotation.
- Retain historical dashboard snapshots for audit readiness and regulatory reviews.

For dashboard schema expectations, refer to [`sample-dashboard.json`](./sample-dashboard.json).
