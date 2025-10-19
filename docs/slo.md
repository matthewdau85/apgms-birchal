# APGMS SLI/SLOs

## SLIs
- Availability: proportion of successful requests (HTTP 2xx/3xx)
- Latency (p95): GET TTFB; POST total time
- Error Rate: proportion of 5xx responses
- Readiness: /ready returns 200 when dependencies are reachable

## SLOs (quarterly)
- Availability ≥ 99.9%
- Latency p95: GET ≤ 300ms, POST ≤ 700ms
- Error Rate < 0.5%
- Readiness ≥ 99.9%

## Alerts
- Page: Availability < 99.0% for 5m or Error Rate ≥ 1% for 5m
- Ticket: Latency p95 breached for 30m

## Load-testing
- Smoke: `k6 run k6/smoke.js -e BASE_URL=https://api.example.com`
- Load:  `k6 run k6/load.js -e BASE_URL=https://staging-api.example.com`
