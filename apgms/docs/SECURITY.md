# Security Posture Overview

This document summarises the end-to-end controls that keep APGMS resilient. It should be read with the privacy posture in [PRIVACY.md](./PRIVACY.md) and the control traceability in [ASVS-MAP.md](./ASVS-MAP.md).

## Identity and MFA via Identity Provider

- **IdP-first access** – Workforce, partner, and administrator access is federated through our identity provider (IdP) using OIDC. Local credentials in the platform database only exist for seeded demo data and are not used in production logins.
- **Mandatory MFA** – The IdP policy enforces phishing-resistant MFA for all privileged roles (admin, operations, engineering). Business users may authenticate with OTP or WebAuthn; step-up MFA is required before invoking any payment-adjacent API scopes.
- **Lifecycle and off-boarding** – Access reviews run quarterly. Off-boarding removes IdP entitlements immediately and triggers API token revocation in the gateway. Service accounts are vaulted, rotated every 90 days, and scoped to specific automation flows.

## Rate Limiting and Abuse Detection

- **Gateway throttles** – The public edge is fronted by the API Gateway. Default limits are 300 requests per minute per client IP for read endpoints and 60 per minute for mutating endpoints. Limits are enforced upstream of `services/api-gateway` so that expensive Prisma calls cannot be triggered in bulk.
- **Adaptive controls** – Burst handling and anomaly detection are handled by WAF rules that watch for traffic deviating more than 3× the trailing five-minute baseline. Block decisions are logged and forwarded to the audit service for reconciliation.
- **Verification** – Load tests in [`k6/debit-path.js`](../k6/debit-path.js) are executed pre-release to confirm the throttles gracefully degrade instead of failing closed. Any change to the baseline requires an update to the runbook stored in [`docs/ops/runbook.md`](./ops/runbook.md).

## CORS Allowlist Management

- **Service defaults** – The Fastify gateway initialises `@fastify/cors` in [`services/api-gateway/src/index.ts`](../services/api-gateway/src/index.ts). Local development uses `origin: true` to keep DX simple.
- **Environment overrides** – Production environments must export `CORS_ALLOWED_ORIGINS` with a comma-separated list of exact origins. Deployment automation templates translate the list into an array and inject it into the Fastify registration so that only known web properties can call the APIs.
- **Change control** – Requests to add an origin require security sign-off and are tracked in the partner access ledger. Emergency removals can be performed instantly by redeploying the gateway with the updated allowlist.

## Security Headers and Transport Guarantees

- **Transport security** – All web properties and APIs are served behind TLS 1.2+ with HSTS (`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`). Certificates are managed by ACM and rotated automatically.
- **Browser hardening** – Edge proxies inject `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and a baseline Content Security Policy that only permits scripts from the first-party CDN. Front-end teams must document any required exceptions before deployment.
- **API responses** – JSON APIs return `Cache-Control: no-store` and `Pragma: no-cache` when serving sensitive banking payloads. The same header set is captured in incident response evidence under [`docs/evidence/README.md`](./evidence/README.md).

## Continuous Improvement

Security posture is reviewed after every quarterly penetration test and whenever a critical CVE lands in the dependency tree. Action items are tracked in the security backlog and cross-referenced with the assurance artefacts listed in [OSF-QUESTIONNAIRE.md](./OSF-QUESTIONNAIRE.md).
