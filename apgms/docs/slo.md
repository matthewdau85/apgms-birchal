# Service Level Objectives

This document captures the current Service Level Objectives (SLOs) for outbound HTTP interactions and the workloads exercised by our k6 test suites.

## Availability
- **Objective:** Maintain a monthly availability of **99.5%** or greater for customer facing APIs.
- **Measurement:** Based on the proportion of successful HTTP responses (<500 status codes) observed in production and load testing.
- **Alert threshold:** Trigger an investigation when the rolling 6-hour error rate exceeds **0.5%**.

## Latency
- **Objective:** Keep the **p95** request latency under **120 ms** during steady state traffic.
- **Measurement:** `http_req_duration` metrics sampled from production observability tools and the `k6/load.js` scenario.
- **Alert threshold:** Trigger an investigation if p95 latency remains above **150 ms** for 15 minutes or more.

## Error Budget
- **Objective:** Limit failed outbound requests to under **1%** of total volume.
- **Measurement:** `http_req_failed` in k6 along with production metrics.
- **Alert threshold:** Halt deploys if the 24-hour rolling error budget consumption exceeds **50%** of the monthly allowance.

## Test Alignment
- `k6/smoke.js` validates correctness at low request volumes to catch regressions quickly.
- `k6/load.js` targets ~200 requests per second and enforces the latency and error-rate SLO thresholds via automated k6 thresholds.
- Load test summaries are written to `artifacts/` to provide auditable evidence that runs met or documented deviations from these objectives.
