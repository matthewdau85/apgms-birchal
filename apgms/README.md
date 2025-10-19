# APGMS

Quickstart:
pnpm i
pnpm -r build
docker compose up -d
pnpm -r test
pnpm -w exec playwright test

## Configuration

Copy `.env.example` to `.env` and update the values to match your environment. The
API gateway requires the following settings:

| Variable | Description |
| --- | --- |
| `PORT` | Port the gateway listens on. |
| `ALLOWED_ORIGINS` | Comma separated list of origins allowed by CORS (`*` for any). |
| `RATE_LIMIT_MAX` | Maximum requests per window for rate limiting middleware. |
| `REDIS_URL` | Redis connection string used by rate limiting and caching. |
| `JWT_ISSUER` | Issuer value embedded in gateway-issued JWTs. |
| `JWT_AUDIENCE` | Audience value embedded in gateway-issued JWTs. |
| `JWT_SECRET` | Shared secret for signing tokens (mutually exclusive with key pair). |
| `JWT_PUBLIC_KEY` / `JWT_PRIVATE_KEY` | RSA key pair used when asymmetric signing is preferred. |
| `DATABASE_URL` | Connection string for the shared database. |

Provide either `JWT_SECRET` or both `JWT_PUBLIC_KEY` and `JWT_PRIVATE_KEY`. The
application validates these variables on boot and will exit with a descriptive
error if any required values are missing or malformed.

## Rotating JWT credentials

Use the helper script to generate new signing material:

```bash
# Generate a new shared secret
node scripts/key-rotate.ts --secret

# Generate a new RSA key pair (values are escaped for .env compatibility)
node scripts/key-rotate.ts --rsa
```

Update your secret manager or `.env` file with the emitted values and redeploy
services that depend on the gateway.
