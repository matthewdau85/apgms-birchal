# Secret Management

The APGMS stack expects service credentials and connection strings to be provided via environment variables rather than hardcoded defaults.

## Required Environment Variables

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` — PostgreSQL application credentials consumed by Docker Compose and backend services.
- `DATABASE_URL` — Full connection string for Prisma clients.
- `REDIS_PASSWORD` — Optional Redis password used when Docker Compose starts the cache service.
- `CORS_ALLOWLIST` — Comma-separated list of origins permitted to reach the API gateway in production.

## Recommended Storage

Secrets should be stored in your team's secret manager (for example, AWS Secrets Manager, GCP Secret Manager, or HashiCorp Vault). Generate an `.env` file for local development with placeholders that load values from the secret store during deployment pipelines.

## Rotation Guidance

Rotate credentials regularly and immediately after suspected exposure. Update the secret manager entry, redeploy services, and refresh any local `.env` files using the new values.
