# Security Overview

## Threat Model
- **Assets:** Customer PII, payment details, API credentials, deployment secrets, audit artifacts.
- **Adversaries:** External attackers, malicious insiders, compromised third-party integrations, automated bots.
- **Attack Surfaces:** Public web/API endpoints, CI/CD pipeline, third-party webhooks, admin consoles, infrastructure management plane.
- **Assumptions:** Production workloads run in segmented VPCs, managed services are patched, and least-privilege IAM is enforced across cloud accounts.
- **Mitigations:** Network segmentation, WAF with anomaly detection, automated dependency scanning, infrastructure as code with policy guardrails, and continuous monitoring via SIEM.

## Authentication & MFA Posture
- SSO via OIDC with enforced MFA (WebAuthn + TOTP fallback) for all workforce identities.
- Service-to-service auth uses short-lived OAuth 2.0 client credentials with mutual TLS.
- Password auth is disabled; break-glass accounts rotate secrets every 24 hours and require hardware tokens.

## RBAC & Organizational Scope
- Role definitions codified in `infra/iam` with Terraform; changes require peer review and automated policy linting.
- Production access limited to on-call SREs; least-privilege enforced via attribute-based policies scoped to environment and service.
- Customer tenancy isolated at the database schema level with row-level security for sensitive tables.

## Input & Output Validation
- Backend services validate payloads with JSON Schema and type-safe DTOs; all user-supplied data is sanitised before persistence.
- Output encoding performed at render time to prevent XSS; templating engine auto-escapes by default.
- File uploads scanned with ClamAV and limited to whitelisted MIME types and size thresholds.

## CORS & Rate Limiting
- CORS restricted to first-party origins with strict `Access-Control-Allow-Credentials` handling.
- API Gateway enforces adaptive rate limiting (per-IP and per-token) with circuit breakers for abuse detection.
- Slowloris and burst protection configured on edge load balancers.

## Idempotency & Webhook Anti-Replay
- Public POST endpoints accept `Idempotency-Key` headers persisted for 24 hours to deduplicate retries.
- Webhooks require signed payloads (Ed25519) with timestamp validation; replays rejected when signature or nonce reused.
- Delivery status tracked with monotonic sequence numbers to prevent out-of-order processing.

## RPT & Audit Chain
- Release, patch, and test (RPT) lifecycle tracked in Git tags with signed commits; SBOM generated per release.
- CI publishes immutable build artifacts to artifact registry with provenance attestations (SLSA Level 3).
- Audit logs (IAM, data access, config changes) streamed to tamper-evident storage with WORM retention.

## Secrets Management & Key Rotation
- Secrets stored in HSM-backed vault with dynamic credentials and automatic rotation (≤30 days).
- TLS certificates issued via ACME with 60-day rotation; database encryption keys rotated quarterly.
- Secret material never committed to Git; pre-commit hooks and CI scanners block leakage.

## Logging & Monitoring
- Security events (auth failures, privilege escalations, policy changes) forwarded to SIEM within 60 seconds.
- PII minimised via tokenisation; redaction policies enforced before log ingestion.
- Log retention: 13 months for security events, 90 days for application traces; archived logs encrypted at rest.

## Incident Response & NDB Obligations
- 24/7 incident response rota with defined severity matrix and playbooks stored in `docs/ir/`.
- Notifiable data breach (NDB) process aligns with OAIC guidance: assessment within 30 days, notification templates pre-approved.
- Post-incident reviews mandatory within 5 business days, with remediation tracked in Jira until closure.

## SBR/AS4 Artifacts
- Standard Business Reporting (SBR) messages transported via AS4 gateway with mutual TLS and WS-Security signatures.
- AS4 receipts stored alongside payloads for 7 years; automated integrity checks verify digest values.
- Schema validation performed against ATO SBR definitions prior to submission; failures trigger alerts.

## CI Gates & Assurance Activities
- CI pipeline enforces OWASP ASVS Level 2 gate (ZAP scan, dependency checks, IaC policy tests).
- Golden path tests cover auth flows, RBAC boundary conditions, and data export controls.
- Quarterly red-team exercises simulate credential stuffing, lateral movement, and supply chain attacks; findings tracked to resolution.

## Security Review Requests
- Engineers must open a "Security Review" ticket in Jira with architecture diagrams, data classifications, and test evidence.
- Security team commits to triage within 2 business days; reviews tracked in shared calendar with defined exit criteria.
- For urgent changes, page on-call security engineer via PagerDuty and follow up with ticket documenting decisions.
