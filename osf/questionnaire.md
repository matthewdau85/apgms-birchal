# OSF Security Questionnaire

## Respondent Information
- **Organization:** Birchal Platform Engineering
- **Respondent Name:** Alex Doe, Head of Security Engineering
- **Contact Email:** security@birchal.example
- **Date:** 2024-05-27

## 1. Authentication & Access Control
**Q:** Describe how administrator and customer accounts are protected.

**A:** All user accounts are required to enroll in time-based one-time password (TOTP) multi-factor authentication (MFA). Administrative accounts additionally enforce hardware-backed WebAuthn authenticators. Authentication workflows are implemented through our identity provider, which enforces adaptive risk checks and password rotation policies. [evidence](../evidence/osf/mfa.md)

## 2. Session Management
**Q:** How do you protect against session hijacking and replay attacks?

**A:** Sessions are bound to device fingerprints and short-lived JWTs that are rotated every 10 minutes. Backend services validate nonce fields against a Redis-backed replay cache; any duplicate nonce triggers an alert and invalidates the session token. Replay detection and mitigation are documented in automated CI security regression tests. [evidence](../evidence/osf/replay-protection-logs.md)

## 3. API Security
**Q:** What measures are in place to prevent abuse of public APIs?

**A:** All external APIs are fronted by an API gateway with IP- and token-based rate limiting, request body size constraints, and behavioral anomaly detection. When thresholds are exceeded, callers are temporarily quarantined and security operations is notified. Rate limit tuning is included in the continuous performance suite. [evidence](../evidence/osf/rate-limiting.md)

## 4. Cross-Origin Resource Sharing (CORS)
**Q:** How are cross-origin requests controlled for web clients?

**A:** The platform applies an allowlist-based CORS policy that enumerates production domains and blocks credentialed requests from non-approved origins. Preflight responses include strict cache durations and custom headers are validated server-side. Configurations are managed via infrastructure-as-code and reviewed during release. [evidence](../evidence/osf/cors.md)

## 5. Logging & Monitoring
**Q:** Describe logging, alerting, and traceability coverage.

**A:** Application, infrastructure, and security events are streamed into our OpenTelemetry (OTEL) pipeline, enriched with user and request metadata, and stored with 30-day retention. High-severity alerts integrate with PagerDuty, and trace sampling is dynamically adjusted to capture anomalies. [evidence](../evidence/osf/otel-traces.md)

## 6. Software Supply Chain Security
**Q:** Do you produce and review software bills of materials (SBOMs)?

**A:** Each build generates SPDX-compliant SBOMs using Syft, which are stored in our artifact repository and validated against known vulnerability feeds before deployment. SBOM drift is monitored in CI, and any new component requires explicit approval. [evidence](../evidence/osf/sbom.md)

## 7. Secure Development Lifecycle
**Q:** Outline secure development lifecycle (SDL) practices.

**A:** Engineers follow a secure coding standard aligned with OWASP ASVS. Pull requests require code review and automated SAST/DAST scans. Threat modeling is performed for major features, and security champions conduct quarterly training. Findings are tracked in Jira with remediation SLAs tied to severity.

## 8. Infrastructure Security
**Q:** How is infrastructure hardened and patched?

**A:** All infrastructure is provisioned through Terraform with CIS benchmark baselines. We apply weekly automated patch cycles, enforce configuration drift detection, and run vulnerability scans against container images and hosts prior to promotion.

## 9. Data Protection
**Q:** Explain data encryption and segregation controls.

**A:** Data at rest is encrypted with AES-256 using customer-managed keys stored in AWS KMS. Data in transit uses TLS 1.2+ with mutual TLS for service-to-service communication. Multi-tenant data is segregated logically via tenant identifiers and access control lists enforced in every query path.

## 10. Incident Response
**Q:** Summarize incident response readiness.

**A:** A 24/7 incident response team follows a documented playbook with defined escalation paths. We run semi-annual tabletop exercises and post-incident reviews that feed into backlog improvements. Evidence retention and communication plans are part of the playbook.

## 11. Business Continuity & Disaster Recovery
**Q:** What business continuity measures exist?

**A:** Critical services run across multiple availability zones with automated failover. Daily backups are validated via restore drills, and recovery point/time objectives (RPO 15 minutes / RTO 1 hour) are monitored by the SRE team.

## 12. Compliance & Auditing
**Q:** Which compliance frameworks guide your controls?

**A:** The organization maintains SOC 2 Type II and ISO 27001 certifications. Controls are audited annually, and evidence is stored in a centralized GRC platform. Continuous control monitoring ensures deviations are remediated promptly.

## 13. Privacy & Data Subject Rights
**Q:** How are privacy obligations addressed?

**A:** Data handling aligns with GDPR and CCPA requirements. Data subject requests are processed via automated workflows with legal oversight, and audit logs track fulfillment.

## 14. Third-Party Risk Management
**Q:** How do you manage vendor security risk?

**A:** Vendors undergo risk assessment using SIG questionnaires and security ratings. Contracts require breach notification clauses, and high-risk vendors are monitored quarterly.

## 15. Change Management
**Q:** Describe change management governance.

**A:** All production changes require Change Advisory Board (CAB) approval, integration test results, and rollback plans. Deployments are automated with canary releases and monitored via OTEL dashboards.

