# Ops runbook

## Service level objectives

| Service | SLI definition | SLO target | Error budget |
| --- | --- | --- | --- |
| API Gateway | Availability measured as successful (2xx/3xx) responses over total requests in 5-minute windows | 99.5% monthly | 216 minutes per month |
| Payments, Recon, Audit services | Successful job completions over total jobs in 15-minute windows | 99.0% monthly | 432 minutes per month |
| Tax Engine | 95th percentile response time for tax calculations | ≤ 400ms per request | 36 hours per quarter |

Engineering on-call reviews SLO dashboards hourly during incidents. Any breach consuming >25% of the monthly error budget triggers an incident retrospective and mitigation backlog review.

## Circuit breaker policy

We enforce service-to-service resilience with the following policy:

1. **Fast failure** – clients integrate with the shared gRPC/REST client that opens a circuit after 5 consecutive failures or a rolling 50% error rate within 30 seconds.
2. **Cooldown** – once opened, the circuit remains open for 60 seconds before permitting a single trial request. Subsequent failures extend the lockout exponentially (60s, 120s, 240s).
3. **Fallbacks** – while the circuit is open the gateway serves cached responses for idempotent GETs and queues mutation requests to the job bus for replay.
4. **Alerting** – Prometheus alerts fire when a circuit remains open for >5 minutes or opens more than three times in an hour, paging the primary on-call.

Implementation notes live with the shared service clients and are exercised via chaos testing every sprint.

## Deployment guardrails

Blue/green deployment pipelines keep the previous environment warm for 30 minutes after cutover. The release owner validates health, metrics, and smoke tests before switching DNS. Rollback uses the preserved image digest and Terraform state to ensure drift-free recovery.

## Synthetic probes and regression

Synthetic API probes run from three regions every minute and raise alerts if two consecutive checks fail. Database migrations trigger the regression suite, which covers API fuzz tests, property-based tax-engine tests, and Playwright visual snapshots to guard against unexpected UI deltas.
