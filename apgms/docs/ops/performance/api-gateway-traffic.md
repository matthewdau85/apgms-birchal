# API gateway traffic & profiling snapshot

This snapshot captures request volumes and timing metrics collected via the `mock:traffic` simulation. The script exercises the API gateway using the in-process Fastify injector with the mock database layer and persists structured metrics through the shared collector utilities.

## How the data was gathered

1. `pnpm --filter @apgms/api-gateway mock:traffic` runs `scripts/mock-traffic.ts`, which reuses the production Fastify app with `USE_MOCK_DB` enabled so that requests complete without an external Postgres instance.
2. The app now instruments each request/response cycle plus every Prisma call (or its mock equivalent) via `MetricsCollector`, emitting JSONL request traces and aggregated summaries under `services/api-gateway/metrics/mock-run/`.
3. The summary file captures request counts, averages, and p95 latencies for both HTTP handlers and the underlying data access methods, which is what this report is based on.

## Top endpoints by traffic

| Rank | Endpoint          | Count | Avg duration (ms) | p95 duration (ms) |
| ---- | ----------------- | ----- | ----------------- | ----------------- |
| 1    | GET /health       | 220   | 0.23              | 0.32              |
| 2    | GET /bank-lines   | 140   | 33.62             | 38.11             |
| 3    | GET /users        | 90    | 21.46             | 24.29             |
| 4    | POST /bank-lines  | 60    | 51.08             | 56.59             |

_Source: `services/api-gateway/metrics/mock-run/summary.json`._

## Instrumented database/computation spans

| Operation               | Count | Avg duration (ms) | p95 duration (ms) | Notes |
| ----------------------- | ----- | ----------------- | ----------------- | ----- |
| db.bankLine.findMany    | 140   | 32.95             | 37.54             | Dominates GET /bank-lines throughput. |
| db.user.findMany        | 90    | 20.78             | 23.63             | Backing store for the /users table view. |
| db.bankLine.create      | 60    | 49.92             | 55.45             | Slowest span; includes validation plus checksum simulation. |

_Source: `services/api-gateway/metrics/mock-run/summary.json`._

## Key findings

- The `/health` probe unsurprisingly leads in request volume, but it is effectively free (~0.23 ms average) and not a concern for performance tuning. 【F:services/api-gateway/metrics/mock-run/summary.json†L1-L24】
- `/bank-lines` endpoints (GET and POST) are the primary hotspots: GET spends ~33 ms per call, and POST averages ~51 ms while exhibiting the highest p95/maximum latency across the workload. 【F:services/api-gateway/metrics/mock-run/summary.json†L5-L39】
- Database spans mirror the route profile. `db.bankLine.create` is the slowest repeated operation, suggesting insert-heavy scenarios would benefit most from optimization (query tuning, payload validation, or batching). 【F:services/api-gateway/metrics/mock-run/summary.json†L26-L39】

## Reproducing the snapshot

```bash
cd services/api-gateway
pnpm mock:traffic
```

The metrics collector will refresh the JSONL logs and summary under `metrics/mock-run/`. The report can then be regenerated or extended by reading the new `summary.json`.
