# OWASP ASVS L2 Mapping

This document captures how the Birchal gateway satisfies the key OWASP ASVS Level 2 controls audited during the latest security review.

## V2 – Authentication

- **V2.1 Password policy:** Delegated to the enterprise IdP (Azure AD). MFA is mandatory and enforced via `amr: ['pwd', 'mfa']` claim checks inside [`services/api-gateway/src/index.ts`](../../services/api-gateway/src/index.ts).
- **V2.5 Token verification:** Access tokens are validated using JWKS or HMAC secrets via `createAccessTokenVerifier`. Audience and issuer mismatches trigger `401` responses.

## V3 – Session Management & Input Validation

- **V3.3 Session timeouts:** Access tokens expire within 15 minutes. Refresh tokens can only be used via the IdP.
- **V3.9 Input validation:** All request payloads are parsed through `zod` schemas. Invalid input generates a sanitized error without reflecting user-provided data.
- **V3.14 JSON output encoding:** API responses are serialized through Fastify’s safe JSON serializer, preventing injection of executable content.

## V4 – Access Control

- **V4.1 Enforce least privilege:** Every route checks role or scope assignments before executing. `/users` is restricted to `admin`, while finance routes require `finance:read`/`finance:write` scopes.
- **V4.2 Tenant isolation:** Prisma queries always include `where: { orgId: request.auth.orgId }`, preventing cross-tenant data leakage.
- **V4.5 Idempotent actions:** Financial mutations rely on stored idempotency keys to stop replay attacks.

## V7 – Error Handling & Logging

- **V7.1 Error response handling:** Fastify-sensible normalizes errors into JSON payloads without stack traces in production.
- **V7.3 Security logging:** Sensitive events are captured in the `AuditEvent` table with user, IP, and metadata and exported to the SIEM.

## V9 – Communications

- **V9.1 Transport security:** TLS termination is enforced at the ingress. HSTS and secure headers are applied via `@fastify/helmet`.
- **V9.4 API security:** CORS is restricted to allowlisted origins and rate-limiting is enforced at 120 rpm per caller.

## V14 – Configuration

- **V14.2 Secure defaults:** Environment variables are sourced from the hardened secret manager; Fastify runs with a redacted logger configuration.
- **V14.4 Dependency management:** SBOM generation and dependency allowlists are tracked in `docs/security/sbom/` and validated as part of CI.

### Review cadence

The ASVS mapping is reviewed quarterly during the security guild meeting. Deviations or compensating controls are tracked in Jira project `SEC`.
