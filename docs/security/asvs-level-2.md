# OWASP ASVS Level 2 Mapping

This document records how the APGMS platform satisfies the OWASP Application Security Verification Standard (ASVS) Level 2 controls. Ownership is shared between the security engineering team and service owners.

## Summary

- **Scope**: Customer Portal, API Gateway, Audit, Payments, Registries services.
- **Methodology**: Automated security testing within CI/CD, periodic manual reviews, and independent penetration testing each quarter.
- **Last Review**: 2024-07-05

## Control Implementation Matrix

| ASVS Section | Control Highlights | Evidence Source | Owner |
| --- | --- | --- | --- |
| V1 Architecture, Design & Threat Modelling | STRIDE threat model updated quarterly; design reviews required for new APIs | `docs/architecture/README.md` | Lead Architect |
| V2 Authentication | OAuth 2.0 with PKCE for customer portal, mutual TLS between services | `services/api-gateway/docs/auth.md` (TBD), CI tests | API Gateway Lead |
| V3 Session Management | 24h token expiry, refresh rotation, Redis-backed session revocation | GitHub Actions `session-security` job logs | Security Engineer |
| V4 Access Control | OPA policies versioned in `policy/` repo, enforced at gateway and service layers | `policy/` repository; CI policy tests | Security Engineer |
| V5 Validation, Sanitisation & Encoding | Centralised validation library, JSON schema enforcement, output encoding via React escaping | Unit tests (`npm test`), SAST reports | Service Owners |
| V7 Cryptography | TLS 1.2+, AES-256-GCM for data at rest, Hashicorp Vault for secrets | Vault policy exports, TLS config in Terraform | Platform Team |
| V8 Error Handling & Logging | Structured logging with PII scrubbing, centralized log retention 180 days | Loki dashboards, log scrubbing unit tests | Observability Team |
| V9 Data Protection | Field-level encryption, GDPR data retention policies, secure deletes via background jobs | Data retention runbooks, deletion job metrics | Data Protection Officer |
| V10 Communications | HSTS enabled, WAF in front of customer portal, service-to-service via mutual TLS | Terraform `infrastructure/networking` | Platform Team |
| V11 HTTP Security | HTTP security headers enforced via middleware, Content Security Policy for portal | `services/api-gateway/src/middleware/security.ts` | API Gateway Lead |
| V14 Configuration | Immutable infrastructure, config via environment variables, secrets in Vault | Terraform state, Vault audit logs | Platform Team |

## Testing Approach

- **Static Analysis**: `npm run lint` and dependency scanning via `npm audit` with fail-on-high severity.
- **Dynamic Testing**: Nightly ZAP baseline scans and authenticated API tests.
- **Software Composition Analysis**: SBOM generated with Syft; tracked in evidence index.
- **Performance & Resilience**: Load tests via k6; chaos experiments monthly.

## Gap Tracking

| Control | Gap | Target Fix | Status |
| --- | --- | --- | --- |
| V2 | Centralised identity provider integration for partner banks | 2024-11-30 | In Progress |
| V5 | Input validation coverage for legacy upload endpoint | 2024-09-15 | Planned |
| V14 | Automate drift detection alerts in Terraform Cloud | 2024-08-31 | In Progress |

