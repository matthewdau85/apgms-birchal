# Threat Model

## System Overview
The APGMS platform consists of the following core components:
- Web Application (Next.js frontend) served via CDN.
- API Gateway that fronts microservices for portfolio management, investor onboarding, and analytics.
- Authentication service integrating with third-party identity provider.
- Data stores: PostgreSQL (transactions, users), Redis (sessions), S3-compatible object storage (documents).
- External integrations: Payment processor, KYC provider, notification service.

## Data Flow Diagram (DFD)
1. **Investor Browser** → HTTPS → **CDN / Web App** → API calls to **API Gateway**.
2. **API Gateway** → mTLS → **Microservices** (Portfolio, Onboarding, Analytics).
3. **Microservices** ↔ **PostgreSQL** (encrypted at rest) for persistent data.
4. **Onboarding Service** → HTTPS → **KYC Provider** (PII transfer, response tokens stored).
5. **Portfolio Service** → HTTPS → **Payment Processor** (tokenized payment info).
6. **Notification Service** pulls events from **Event Bus** and sends via email/SMS provider.
7. **Admin Portal** → SSO → **API Gateway** with elevated scopes for operations staff.

## Assets
- Investor personal and financial data.
- Authentication secrets and session tokens.
- Payment tokens and transaction records.
- Administrative audit logs and operational dashboards.

## Threat Actors
- External attackers attempting account takeover or data exfiltration.
- Malicious insiders with privileged access.
- Third-party service compromise (KYC, payments).
- Automated bot traffic seeking to abuse onboarding workflows.

## Security Controls
- TLS 1.2+ enforced on all external endpoints; HSTS enabled at CDN.
- OAuth 2.0 / OIDC for user authentication; refresh tokens stored in HTTP-only cookies.
- Role-based access control enforced at API gateway and service layer.
- Data encryption at rest using cloud-managed KMS for PostgreSQL, object storage, and backups.
- Web Application Firewall (WAF) rules for OWASP Top 10 patterns; rate limiting via CDN.
- Secrets managed via HashiCorp Vault; rotation policies every 90 days.
- Audit logging centralized in SIEM with immutable storage for 365 days.

## Residual Risks & Mitigations
- **Supply Chain Risk:** mitigated via dependency scanning and signed releases.
- **Denial of Service:** mitigated through auto-scaling and CDN edge protections.
- **Insider Abuse:** mitigated with least-privilege IAM, activity monitoring, and quarterly access reviews.

## Review Cadence
Threat model reviewed quarterly and after major architecture changes; tracked in Jira security backlog.
