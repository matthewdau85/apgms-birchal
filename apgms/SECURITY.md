# Security Policy

We take the protection of taxation, banking, and payroll data seriously. Security issues should be reported to **security@apgms.io** with the subject line `SECURITY DISCLOSURE`. Our security inbox is monitored 24/7 by the on-call incident commander.

## Reporting Guidelines

- Please provide a proof of concept and the minimal steps required to reproduce the issue.
- Do not perform denial-of-service testing against production endpoints. Rate-limit and anti-replay protections are in place and may temporarily block abusive activity.
- Avoid accessing personal data that does not belong to you. Where exploitation requires data access, redact or anonymise any screenshots or payloads that contain customer information.
- If the issue involves authentication tokens, please include the token headers/claims only—never share full secrets.

We acknowledge new reports within **one business day** and provide a remediation plan or mitigation ETA within **five business days**. Critical issues (CVSS ≥ 9) trigger an incident bridge and 24-hour response SLAs.

## Coordinated Disclosure

We support coordinated disclosure. Please do not share details publicly until we have deployed a fix or 30 days have elapsed, whichever comes first. When crediting reporters we will, with your consent, publish a summary in the security changelog on [status.apgms.io](https://status.apgms.io).

## Safeguards in Production

The platform enforces:

- Mandatory multi-factor authentication for all production users via the upstream IdP. API requests without the `amr`/`mfa` claim are rejected.
- Role-based access control with organisational scoping, restricting tenant data to the owning entity.
- Per-request rate limiting, request body caps, idempotency keys, and anti-replay storage for financial mutations.
- Structured security event logging persisted in the `AuditEvent` table and shipped to the SIEM every five minutes.
- Signed dependency manifests (SBOM) stored in the supply-chain evidence folder and verified during build time.

These controls are monitored by the security team. Reach out if you require additional assurance artefacts or penetration test results.
