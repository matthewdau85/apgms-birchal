# Security Policy

Email: security@yourdomain.example

## Auth, CORS, Rate limiting

The API Gateway enforces authentication, authorization, and transport policies through dedicated Fastify plugins.

- **Authentication & Authorization**
  - `AUTH_BYPASS=true` (development only) enables a stubbed bearer flow that trusts the headers `x-dev-user`, `x-dev-email`, `x-dev-org`, and `x-dev-roles`. Requests missing the minimum `x-dev-user` and `x-dev-org` headers are rejected with `401`.
  - When `AUTH_BYPASS` is unset or `false`, the gateway expects a standard `Authorization: Bearer <token>` header. Token verification is not yet implemented, but the JWT payload (if present) seeds the request `user` context for downstream guards.
  - Route guards `requireRole(...roles)` and `requireOrgScope()` are available to handlers. `requireRole` enforces that the authenticated user possesses at least one of the supplied roles, while `requireOrgScope` confirms that the caller's `orgId` matches the `orgId` present in the request body or query string.
- **CORS**
  - In development (`NODE_ENV !== "production"`), cross-origin requests are limited to `http://localhost:5173`.
  - In production, allowed origins are sourced exclusively from the comma-separated `ALLOWED_ORIGINS` environment variable. Empty configuration results in all browser origins being denied.
- **Rate limiting & request size**
  - Each client IP is limited to **100 requests per minute** and **10 requests per 10 seconds**. Exceeding either window returns `429 rate_limit_exceeded`.
  - Incoming payloads over **1 MiB** are rejected with `413 payload_too_large`. The Fastify server also sets an application-wide `bodyLimit` of 1 MiB.
