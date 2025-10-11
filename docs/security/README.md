# Security Documentation

This document expands the security backlog by capturing the current threat landscape, mandatory controls, and supporting processes for the APGMS platform.

## System Overview and Assets

- **API Gateway (`@apgms/api-gateway`)**: Handles external HTTP requests via Fastify. Exposes `/health`, `/users`, and `/bank-lines` endpoints and uses Prisma to access PostgreSQL (`apgms/services/api-gateway/src/index.ts`).
- **Shared Database**: PostgreSQL schema (`apgms/shared/prisma/schema.prisma`) that stores organisations, users, and bank transaction lines.
- **Background Worker (`@apgms/worker`)**: Planned Node.js service for asynchronous jobs (currently stubbed).
- **Tax Engine (`@apgms/tax-engine`)**: FastAPI service intended for fiscal calculations.
- **Secrets**: Environment variables (`DATABASE_URL`, `SHADOW_DATABASE_URL`, future API keys) loaded through `.env` and `dotenv`.

## Threat Model Summary

| Threat | Vector | Impact | Mitigations |
| --- | --- | --- | --- |
| Unauthenticated data access | `/users` and `/bank-lines` endpoints lack authentication/authorisation. | Exposure of sensitive financial data. | Implement authentication (OAuth2/JWT) and role-based access. Enforce least privilege on Prisma queries. |
| Injection attacks | Fastify endpoints map request bodies directly into Prisma create calls. | Data integrity compromise, potential RCE via database. | Validate payloads with `zod`, use parameterised queries (Prisma defaults), enable logging/auditing. |
| Secrets leakage | `.env` files may be mishandled. | Database credentials exposure. | Use secret management (e.g. AWS Secrets Manager), restrict file permissions, avoid committing `.env` to VCS. |
| Supply chain vulnerabilities | Dependencies include Fastify, Prisma, tsx, and Python FastAPI. | Exploitation via vulnerable libraries. | Automate dependency scanning (npm audit, Snyk), monitor advisories, pin versions. |
| Denial of Service | Gateway currently trusts all origins and lacks rate limiting. | Service outage, resource exhaustion. | Introduce rate limiting middleware, configure Fastify CORS with allow-list, deploy WAF/CDN. |
| Data persistence failures | Redis/Postgres downtime or data corruption. | Data loss, system unavailability. | Configure backups, replication, and health monitoring. |

## Control Requirements

1. **Authentication & Authorisation**
   - Protect all non-health endpoints with authenticated sessions or API keys.
   - Introduce role-based access models for organisations (admin vs. read-only) enforced at Prisma query level.
2. **Secure Coding**
   - Validate all request bodies and query parameters using schema validation (`zod`) before database operations.
   - Adopt secure defaults in Fastify (helmet plugin for headers, disable detailed error stacks in production).
3. **Transport Security**
   - Terminate TLS at the edge and enforce HTTPS-only access for all clients.
   - Use modern TLS configurations (TLS 1.2+).
4. **Logging & Monitoring**
   - Capture structured security events (logins, permission changes, data exports) and forward to SIEM.
   - Retain logs for at least 90 days with tamper-evident storage.
5. **Data Protection**
   - Encrypt Postgres at rest (managed service configuration) and ensure backups are encrypted.
   - Classify stored data (PII, financial) and restrict engineer access via IAM roles.
6. **Change Control**
   - Enforce mandatory peer review and security sign-off for changes touching authentication, payments, or data models.

## Vulnerability Management Process

- **Scanning**: Run `pnpm audit` for JavaScript packages and `pip-audit` for Python components during CI. Track findings in the security backlog.
- **Patch SLAs**: Critical issues remediated within 7 days, high severity within 14 days, medium within 30 days.
- **Verification**: After patching, re-run scans and, where applicable, add regression tests.
- **Disclosure**: Security researchers are directed to `security@yourdomain.example` (`apgms/SECURITY.md`). Responses must be acknowledged within 2 business days.

## Third-Party Risk Assessment

| Dependency | Purpose | Risk Considerations | Actions |
| --- | --- | --- | --- |
| Fastify | Primary HTTP server | Frequent security updates; plugins must be vetted. | Track advisories, pin versions, run security headers plugin. |
| Prisma Client | ORM and schema migrations | Manages database connections; misconfiguration can leak data. | Restrict database privileges, rotate credentials periodically. |
| Redis | Cache/coordination | Potential for data exposure if left unauthenticated. | Require AUTH/ACLs, deploy in private network. |
| PostgreSQL | Primary data store | Contains sensitive customer data. | Enable encryption, backups, and audit logging. |
| FastAPI | Tax engine HTTP server | Additional attack surface. | Apply same auth controls and logging as gateway. |
| pnpm/tsx toolchain | Build/runtime scripts | Supply chain attack vector. | Lock dependency versions and monitor upstream. |

## Compliance and Evidence

- Maintain OWASP ASVS L2 mapping under `apgms/docs/security/ASVS-mapping.md` with status for each control.
- Store threat model diagrams and risk assessments in this directory (`docs/security/`).
- Record penetration test reports and remediation plans with release tags for traceability.
