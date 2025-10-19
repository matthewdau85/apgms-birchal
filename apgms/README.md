# APGMS

## Quickstart

1. Install dependencies: `pnpm i`
2. Copy the sample environment file and customise it: `cp ../.env.example ../.env`
3. Build all workspaces: `pnpm -r build`
4. Start supporting infrastructure: `docker compose up -d`
5. Run the test suites: `pnpm -r test`
6. (Optional) Run browser tests: `pnpm -w exec playwright test`

## Environment configuration

The services rely on a `.env` file located at the repository root. An example configuration is provided in `.env.example` and covers the required variables:

- `NODE_ENV`, `PORT` – runtime mode and listen port for the API gateway.
- `ALLOWED_ORIGINS` – comma-separated list for CORS (`*` allows all origins).
- `DATABASE_URL`, `SHADOW_DATABASE_URL` – Prisma primary and shadow databases.
- `REDIS_URL` – connection string for caching / background jobs.
- `RATE_LIMIT_MAX`, `REQUEST_BODY_LIMIT` – request shaping limits enforced by Fastify plugins.
- `JWT_ISSUER`, `JWT_AUDIENCE`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY` – JWT verification configuration.
- `OTEL_EXPORTER_OTLP_ENDPOINT` – optional OpenTelemetry collector endpoint.

Populate the `.env` file before starting any service. The API gateway validates these values at startup and exits with a descriptive error when something is missing or malformed.

## Rotating JWT signing keys

Use the PowerShell script at `scripts/key-rotate.ps1` to generate a fresh RSA key pair and update the `.env` file automatically:

```powershell
pwsh ./scripts/key-rotate.ps1
```

The script writes the new key material to `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY` (escaped for `.env` consumption) and prints the location that was updated. Pass `-EnvPath` to target a different file:

```powershell
pwsh ./scripts/key-rotate.ps1 -EnvPath ../configs/.env.staging
```

After rotating the key, redeploy or restart any services that cache the previous key so that newly issued tokens become valid and previously issued tokens are rejected.
