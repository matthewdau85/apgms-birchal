# Run Log Template

Use this template to capture a concise, single-page run log for operational activities.

## Template

| Field | Description |
| --- | --- |
| **Run ID** | Unique identifier for the run (e.g., `RUN-2024-05-01-A`). |
| **Date** | Calendar date of the run (ISO 8601 preferred). |
| **Start Time** | Time the run began, with timezone. |
| **End Time** | Time the run completed, with timezone. |
| **Duration** | Total elapsed time (hh:mm). |
| **Environment** | Target environment(s), such as `staging`, `production`, or `QA`. |
| **Objective** | Primary goal or hypothesis for this run. |
| **Team** | Names and roles of participants on call. |
| **Prerequisites** | Links to approved change tickets, runbooks, or dependencies. |
| **Steps Executed** | Ordered list of actions performed, including commands, dashboards, or playbooks. |
| **Observations** | Key metrics, system behavior, or anomalies observed during the run. |
| **Incidents / Issues** | Any unexpected events, severity, and resolution status. |
| **Mitigations Applied** | Workarounds or fixes deployed during the run. |
| **Backout / Recovery Plan** | Summary of backout steps executed or readiness status. |
| **Result** | Outcome of the run (`Success`, `Partial`, `Failed`) with justification. |
| **Follow-up Tasks** | Action items with owners and target dates. |
| **Artifacts** | URLs or paths to logs, dashboards, recordings, or tickets. |
| **Sign-off** | Approvers who validated the run (name, role, timestamp). |

## Example Entry

| Field | Example |
| --- | --- |
| **Run ID** | RUN-2024-07-15-B |
| **Date** | 2024-07-15 |
| **Start Time** | 18:00 UTC |
| **End Time** | 19:30 UTC |
| **Duration** | 01:30 |
| **Environment** | Production (`apgms-prod-cluster-3`) |
| **Objective** | Deploy feature flag rollout for Birchal partner pricing update and monitor impact. |
| **Team** | Priya K. (Run Lead), Jordan M. (SRE), Alex T. (Observer) |
| **Prerequisites** | CAB-4321 approved; runbook `ops/runbooks/feature-flag-rollout.md` reviewed. |
| **Steps Executed** | 1. Validated pre-check metrics on Grafana dashboard `prod-overview`.<br>2. Enabled feature flag `pricing.partner.birchal` at 10% via LaunchDarkly.<br>3. Monitored error rate and transaction latency for 30 minutes.<br>4. Increased flag to 50% and re-ran health checks.<br>5. Captured post-deploy metrics and exported logs. |
| **Observations** | Latency increased by 5% but remained within SLO. No spike in error rate. |
| **Incidents / Issues** | Minor spike in cache miss ratio at 18:45 UTC (resolved via cache warm-up). |
| **Mitigations Applied** | Executed `scripts/cache-warm.sh --service pricing-api`. |
| **Backout / Recovery Plan** | Backout not required; flag rollback validated and ready if needed. |
| **Result** | Success — rollout reached 50% exposure with stable metrics. |
| **Follow-up Tasks** | FO-1182: Expand to 100% exposure after 24h of stable metrics (Owner: Jordan M., due 2024-07-16). |
| **Artifacts** | Grafana snapshot `https://grafana.example.com/d/abc123`, Log export `s3://apgms-ops/runlogs/2024-07-15B.json`. |
| **Sign-off** | Priya K. (Run Lead) 2024-07-15 19:35 UTC; Jordan M. (SRE) 2024-07-15 19:40 UTC. |
