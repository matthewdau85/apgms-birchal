# Observability Strategy

## Logging
- Centralized structured logging via OpenTelemetry collector.
- Application logs enriched with request IDs, tenant IDs, and user claims.
- Retention: 30 days hot storage in Elasticsearch, 365 days archived to object storage.
- PII minimization enforced through log scrubbing middleware.

## Metrics
- Prometheus scrapes service endpoints at 30-second intervals.
- Key service-level indicators (SLIs): request latency (p95), error rate, throughput, queue depth.
- Alerts defined in Grafana for SLO breaches with paging via PagerDuty.
- Business metrics (investor signups, funds committed) exported to analytics warehouse nightly.

## Traces
- Distributed tracing with OpenTelemetry instrumentation across web, API, and worker services.
- Traces sampled at 10% baseline, auto-increased during incidents using adaptive sampling.
- Trace data retained for 14 days for root cause analysis and 90 days for critical incidents.

## Dashboards & Runbooks
- Grafana dashboards version-controlled under `infra/grafana/` and deployed via CI.
- Runbooks stored in `ops/runbooks/` with direct links from alert notifications.
- Incident retrospectives documented in Confluence with tickets cross-referenced in Jira.
