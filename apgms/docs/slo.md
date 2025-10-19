# APGMS SLI/SLOs

## Services in scope
- API Gateway (`services/api-gateway`)

## SLIs
- **Availability** (Gateway): proportion of successful requests (HTTP 2xx/3xx).
- **Latency (p95)**: time to first byte for GETs; total duration for POSTs.
- **Error Rate**: proportion of 5xx responses.
- **Readiness**: /ready returns UP (200) when dependencies are reachable.

## SLOs (quarterly targets)
- Availability: **≥ 99.9%**
- Latency (p95): **GET ≤ 300ms**, **POST ≤ 700ms**
- Error Rate: **< 0.5%**
- Readiness: **≥ 99.9%**

## Alert policy (suggested)
- Page when: Availability < 99.0% for 5 min, or Error Rate ≥ 1% for 5 min.
- Ticket when: Latency p95 breached for 30 min.

## Measurement & dashboards
- Prometheus metrics from `/metrics` (see http_request_duration_seconds, http_requests_total).
- Grafana dashboards aggregating by route, method, status_code, trace_id.

## Load-testing regimen
- **Smoke** before every deploy: `k6 run k6/smoke.js -e BASE_URL=https://api.example.com`
- **Load** weekly on staging: `k6 run k6/load.js -e BASE_URL=https://staging-api.example.com`
