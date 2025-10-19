# APGMS

Quickstart:
- pnpm i
- pnpm -r build
- docker compose up -d
- pnpm -r test
- pnpm -w exec playwright test

## Load & resilience testing

### k6 smoke/load scenarios

A k6 script that exercises the `/health`, `/users`, and `/bank-lines` endpoints lives in `scripts/k6/load.js`. The script reads `API_BASE_URL`, `VUS`, and `DURATION` from the environment (defaults to `http://localhost:3000`, `5`, and `1m`).

Run the bundled scenario locally after seeding sample data:

```bash
pnpm exec k6 run scripts/k6/load.js
```

You can also launch the PowerShell helper, which forwards the parameters as environment variables:

```powershell
./scripts/k6-load.ps1 -ApiBaseUrl http://localhost:3000 -Vus 10 -Duration 5m
```

Set `LOAD_TEST_ORG_ID`, `LOAD_TEST_AMOUNT`, `LOAD_TEST_PAYEE`, or `LOAD_TEST_DESC` to control the payload used when creating bank lines.

### Resilience-focused unit tests

Outbound client retry and circuit-breaker behaviour is covered by `pnpm --filter @apgms/connectors test`.
