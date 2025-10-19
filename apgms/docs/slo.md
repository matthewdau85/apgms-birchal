# APGMS SLI/SLOs

## Services in scope
- API Gateway (`services/api-gateway`)

## SLIs
- Availability: proportion of 2xx/3xx responses.
- Latency (p95): GET TTFB; POST total duration.
- Error Rate: proportion of 5xx responses.
- Readiness: /ready returns UP (200) when dependencies are reachable.

## SLOs (quarterly)
- Availability: ≥ 99.9%
- Latency p95: GET ≤ 300ms, POST ≤ 700ms
- Error Rate: < 0.5%
- Readiness: ≥ 99.9%

## Alert policy
- Page if Availability < 99.0% for 5 minutes or Error Rate ≥ 1% for 5 minutes.
- Ticket if Latency p95 breached for 30 minutes.

## Load-testing regimen
- Smoke: `k6 run k6/smoke.js -e BASE_URL=https://api.example.com`
- Load:  `k6 run k6/load.js -e BASE_URL=https://staging-api.example.com`
