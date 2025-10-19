# Observability and Monitoring

This document describes the runtime diagnostics exposed by the platform services. The goal is to make it easy to wire the applications into orchestration platforms, dashboards, and alerting systems without having to read the source.

## API Gateway (`services/api-gateway`)

### Health and readiness

The gateway exposes JSON health signals that report the state of the relational database and Redis cache. Both endpoints share the same payload schema.

| Endpoint | Purpose | Success status code |
| --- | --- | --- |
| `GET /health` | Liveness indicator used by load balancers. Returns HTTP 200 with per-component diagnostics even when a dependency is degraded. | 200 |
| `GET /ready` | Readiness indicator used by orchestrators. Returns HTTP 503 if any dependency fails. | 200/503 |

Example response:

```json
{
  "service": "api-gateway",
  "status": "ok",
  "checkedAt": "2024-05-01T12:00:00.000Z",
  "checks": {
    "database": {
      "status": "pass",
      "latencyMs": 12.4,
      "checkedAt": "2024-05-01T12:00:00.000Z"
    },
    "redis": {
      "status": "pass",
      "latencyMs": 3.8,
      "checkedAt": "2024-05-01T12:00:00.000Z"
    }
  }
}
```

### Metrics

Prometheus metrics are exposed via `GET /metrics`. The registry includes default process metrics plus:

- `http_requests_total{method,route,status_code}` – counter of handled HTTP requests.
- `http_request_duration_seconds{method,route,status_code}` – histogram tracking request latency in seconds using server-side timings.

These metrics, along with the trace-aware request logging, are registered during startup and can be scraped by any Prometheus-compatible collector.

## Tax Engine (`services/tax-engine`)

### Health and readiness

The FastAPI application mirrors the gateway behaviour:

| Endpoint | Purpose | Success status code |
| --- | --- | --- |
| `GET /health` | Liveness probe with component-level diagnostics. | 200 |
| `GET /ready` | Readiness probe signalling whether database and Redis sockets are reachable. | 200/503 |

Responses follow the same schema as the gateway service and capture latency measurements together with error details when dependencies are unreachable.

