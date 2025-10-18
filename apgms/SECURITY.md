# Security Policy

Email: security@yourdomain.example

## AuthN

- Fastify gateway enforces bearer token processing with development bypass controls.
- Downstream integrations expected to validate tokens with the configured IdP.

## Roles

- Role-scoped access enforced via reusable Fastify guards (`requireRole`).
- Development headers (`x-dev-roles`) populate role claims during bypass flows.

## MFA via IdP

- Multi-factor enforcement delegated to the identity provider.
- Gateway expects tokens that reflect MFA posture (amr/aal claims) before granting access.

## CORS

- Development allows `http://localhost:5173` for local tooling.
- Production origins derived from the `ALLOWED_ORIGINS` environment variable.

## Rate limiting

- Rate limiting caps clients at 100 requests per minute.
- Burst protection restricts to 10 requests per rolling 10-second window.
