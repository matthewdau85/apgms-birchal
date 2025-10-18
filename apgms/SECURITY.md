# Security

## Threat model (high-level)
- Continuous asset inventory covering webapp, worker, and partner-facing APIs with quarterly STRIDE-based review cycles.
- External adversaries assumed to have network access but no credentials; insider threat modeled via least-privilege roles and dual control on high-impact actions.
- Prioritised attack surfaces include authentication flows, partner integrations, and data-handling pipelines processing investor PII.

## Authentication & MFA (IdP posture; roles)
- Central identity managed through the corporate IdP with SAML/OIDC federation and enforced hardware-backed WebAuthn MFA for admins and staff.
- Role-bound service accounts authenticate via short-lived OAuth2 client credentials issued by the IdP and rotated automatically every 24 hours.
- Privileged roles (Security Admin, Platform Operator) require step-up MFA and device compliance attestation prior to session issuance.

## Authorization (RBAC/org scoping)
- Fine-grained RBAC managed in the `shared/authz` module maps roles to scoped permissions across organisations, offerings, and investor records.
- Tenancy enforcement requires every request context to include an organisation scope; middleware validates scope inheritance to prevent cross-tenant data access.
- Administrative overrides are logged and require dual approval recorded in the audit trail subsystem.

## Input/Output validation (zod, reply validation)
- Request payloads are validated with `zod` schemas in service layer boundaries; failures produce typed error responses without leaking stack traces.
- Outbound replies are coerced through matching schema validation to guarantee contract compliance and eliminate over-posting risks.
- Streaming integrations sanitise partner-supplied content by applying allow-lists and HTML sanitisation where rich text is supported.

## CORS & rate limiting
- CORS restricted to the production and staging domains with preflight caching limited to 5 minutes to minimise risk of origin drift.
- Public APIs throttle per-IP via Redis-leveraged token buckets (default 120 requests/minute) and per-account ceilings keyed by organisation.
- Administrative endpoints inherit stricter rate limits and anomaly detection alerts when behavioural baselines are exceeded.

## Idempotency & replay protection
- Mutating endpoints require idempotency keys persisted with 24-hour TTL, rejecting replays after the first successful application.
- Payment and investor-onboarding workflows embed nonce+timestamp pairs verified via HMAC to prevent cross-channel replay attempts.
- Webhook processors store last-seen event sequence numbers and drop out-of-order deliveries.

## Audit trail & RPT signing (ed25519; rolling hash)
- All security-sensitive actions emit structured audit events to the `services/audit` pipeline where records are immutable and append-only.
- Events are signed using ed25519 keys stored in the HSM-backed signing service; signatures chain through a rolling hash to enable tamper detection.
- Daily proofs are anchored to external storage and verified during compliance attestation.

## Secrets & key mgmt (env, rotation plan)
- Secrets injected via environment variables managed by the infra vault; no secrets are committed to source control or baked into images.
- Rotation plan enforces quarterly credential rollover, with automated rotation for database, queue, and third-party API keys using Terraform workflows.
- Encryption keys reside in the managed KMS with access controlled by service identities and monitored for anomalous usage.

## Logging & retention (security events; PII minimisation)
- Centralised logging pipelines separate security telemetry from application analytics to uphold least-access visibility.
- Logs redact PII fields (e.g., tax IDs, bank details) using schema-aware scrubbing before persistence, with exceptions reviewed during privacy audits.
- Retention set to 400 days for security logs and 90 days for application traces, aligning with legal and investigative requirements.

## Vulnerability mgmt (SCA, patching cadence)
- Automated SCA runs via CI on every merge request and nightly on default branch, blocking builds when critical CVEs are detected.
- Weekly patch window applies OS and runtime updates across all environments, with expedited out-of-band patches for active exploits.
- Dependency upgrades are tracked via Renovate; security team reviews diff reports for high-risk libraries.

## Incident response (link NDB runbook)
- Security incidents follow the playbook defined in the [NDB runbook](docs/ops/runbook.md), including communication trees and legal notification steps.
- On-call rotations ensure 24/7 coverage with explicit escalation criteria for privacy-impacting events.
- Post-incident reviews capture remediation actions and feed back into the threat model updates.

## SBR/AS4 artifacts & evidencing
- AS4 message exchanges archived with delivery receipts and cryptographic proofs stored in the secure evidence repository.
- Submission Business Records (SBR) maintained with checksum verification and quarterly attestations for regulatory inspections.
- Evidence packages are generated automatically for audits and retained for seven years.

## Compliance (ASVS gate; OSF questionnaire path)
- Release gating requires ASVS Level 2 control verification via automated and manual checks documented in CI artifacts.
- Operational Security Framework (OSF) questionnaires reside in `docs/security/osf/` and must be updated before each major release.
- Compliance team reviews attestations semi-annually to ensure continued alignment with regulatory obligations.
