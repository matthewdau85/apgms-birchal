# Observability runbook

- Prometheus scrapes application metrics (`/metrics`) every 15 seconds with 30-day retention.
- Grafana dashboards `Gateway Overview` and `Tax Engine Latency` surface SLO error budget burn-down charts.
- Loki captures structured JSON logs with hash-chained request IDs for forensic traceability.
- Alertmanager routes high-severity alerts to PagerDuty and low-severity notifications to Slack `#ops-watch`.
