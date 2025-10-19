# APGMS On-Call Runbook

## Overview
The API Gateway is the public entry-point for partner integrations and internal tooling.
It fronts multiple downstream services via Fastify. This runbook covers the operational
procedures required when the on-call engineer is paged for availability or latency
incidents that violate the SLOs defined in [`../SLOs.yaml`](../SLOs.yaml).

## Escalation
1. **Acknowledge the page** within 5 minutes.
2. **Notify primary stakeholders:** #apgms-ops Slack channel and the duty product manager.
3. **Determine severity:**
   - Sev1: sustained outage or SLO burn-rate > 4× budget. Page staff SRE and engineering lead.
   - Sev2: elevated errors/latency with customer impact but within budget. Engage feature owner.
   - Sev3: transient alerts cleared after mitigation; update incident log only.
4. **Escalate** to secondary on-call if no mitigation within 15 minutes.

## Dashboards & Telemetry
- **Grafana:** `APGMS / API Gateway Overview` for latency, error budget burn, and traffic.
- **Logs:** Loki query `service="api-gateway"` filtered by trace/span IDs from alerts.
- **Tracing:** Tempo trace search using correlation ID from Fastify request headers.
- **Database:** CloudSQL Postgres metrics for connection saturation and query latency.

## Common Faults & Mitigations
### 1. Latency regression on POST /bank-lines
- Symptom: Alert `ApiGatewayLatencyP95TooHigh` triggered, p95 > 250ms.
- Checks:
  - Verify downstream Prisma queries for slow SQL (`SELECT * FROM pg_stat_activity`).
  - Inspect recent deployments touching allocation logic (`git log -- services/api-gateway`).
  - Compare cache hit ratios in Redis.
- Mitigation:
  - Enable feature flag fallback to bypass enrichment pipeline.
  - Scale API pods via `kubectl scale deploy/api-gateway --replicas=<n>`.
  - If database is bottlenecked, failover to read-replica and enable throttling.

### 2. Elevated 5xx error rate
- Symptom: Alert `ApiGatewayElevatedErrorRate` triggered with error rate > 1%.
- Checks:
  - Examine Fastify logs for stack traces and Prisma connection errors.
  - Validate upstream dependencies (payments, registries) health dashboards.
  - Confirm recent migrations did not alter schema unexpectedly.
- Mitigation:
  - Roll back latest deployment (see rollback section).
  - Disable problematic connectors via configuration service.
  - Engage downstream service owners if dependency outage is identified.

### 3. Database connection exhaustion
- Symptom: `prisma` logs report `P1000`/`P1001` errors and connections > limit.
- Checks:
  - Inspect connection pool metrics in Grafana.
  - Confirm background jobs or ad-hoc scripts running heavy queries.
- Mitigation:
  - Increase pool size temporarily via config map patch.
  - Restart runaway job or move heavy workloads to replica.

## Rollback Procedure
1. Identify the offending release tag from ArgoCD (`api-gateway` application).
2. Run `argocd app rollback api-gateway <REVISION>` to revert to last healthy version.
3. Monitor deployment rollout status until pods become healthy.
4. Validate SLO dashboards return to normal bounds before closing the incident.
5. File an incident retrospective within 24 hours and update this runbook if gaps exist.

## Post-Incident
- Record timeline in incident tracker.
- Capture metrics snapshots for latency and error budgets.
- Schedule follow-up tasks for permanent fixes and capacity adjustments.
