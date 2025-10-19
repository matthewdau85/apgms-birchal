# Gateway Service SLOs

## Overview
The gateway exposes the API surface for customer and partner applications. This document captures our
Service Level Objectives (SLOs), alert thresholds, and the policies governing how we consume the
resulting error budget.

## SLO Summary
| SLO | Target | Measurement Window | Data Source |
| --- | --- | --- | --- |
| p95 request latency | ≤ 300 ms | trailing 30 days | `gateway_request_duration_seconds` histogram exported to Prometheus |
| Availability | ≥ 99.9 % | trailing 30 days | `gateway_request_total` counter with success label |

### Latency Objective
* **User experience**: interactivity for high-traffic flows (`/bank-lines`, `/payments/*`).
* **Budget**: No more than 5% of requests may exceed 300 ms over the 30-day window.

### Availability Objective
* **User experience**: mission-critical API availability for banks, partners, and internal apps.
* **Budget**: Maximum 43m 12s of unavailability during a 30-day period (99.9% availability).

## Error Budget Policy
1. Track budget burn using a 30-day rolling window on both latency and availability.
2. If we consume **25%** of the error budget in 7 consecutive days, freeze non-critical launches
   and require a burn analysis within 48 hours.
3. If we consume **50%** of the budget in 7 consecutive days, initiate a production change review
   and require director approval for new deployments.
4. If the full budget is exhausted, halt all non-emergency changes until burn is <50% and a detailed
   post-incident review is completed.

## Alert Thresholds
| Condition | Threshold | Rationale | Action |
| --- | --- | --- | --- |
| Fast-burn latency | 2% of requests over 300 ms for 15 minutes | Early warning ahead of budget consumption | Page on-call, investigate downstream latency |
| Fast-burn availability | Error ratio >0.1% for 15 minutes | Detect sub-SLO availability drops | Page on-call, verify upstream dependencies |
| Error budget burn rate | 2x over 1 hour | Tracks exhaustion trends | Page SRE lead, schedule burn review |
| Synthetic readiness failure | Any `/readyz` or `/bank-lines` response >200 ms or non-2xx | Catch localized degradation | Page on-call via synthetic alert |

## Observability Requirements
* Expose Prometheus metrics: latency histogram, request counters, and error categorization.
* Emit structured logs including `trace_id`, `customer_id`, and upstream dependency timings.
* Ensure dashboards overlay latency percentiles with deployment markers and dependency health.

## Review Cadence
* Revisit SLO targets quarterly, factoring in traffic patterns and feature changes.
* Validate alert thresholds monthly to ensure page load corresponds to user impact.
