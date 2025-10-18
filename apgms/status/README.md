# Status site

The status site exposes a lightweight dashboard describing the health of the key Birchal treasury services. It is designed to be hosted as a static page backed by the JSON health endpoints each service now exposes.

## Checks

| Endpoint | Purpose |
| -------- | ------- |
| `/api-gateway/health` | Confirms the Fastify gateway can reach the Postgres database and load configuration. |
| `/connectors/health` | Validates the open banking connectors API is responding and that recent sync metadata is available. |
| `/payments/health` | Reports the in-memory payments scheduler is online. |
| `/tax-engine/health` | Confirms the FastAPI app is healthy and ready to calculate GST. |

## Extending

1. Deploy each service behind a public status ingress (CloudFront, Cloudflare, or a reverse proxy).
2. Add client-side polling that aggregates the JSON responses and renders them with uptime history.
3. Layer on synthetic checks (k6/Grafana) that simulate a payment submission or connector resync to capture deeper SLIs.

The status site intentionally stays thin; its job is to highlight regressions and direct operators to the appropriate service dashboards.
