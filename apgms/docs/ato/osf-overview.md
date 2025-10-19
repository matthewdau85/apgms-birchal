# OSF Overview

## Product Scope
- Service: APGMS platform for managing investor onboarding and compliance workflows.
- Components: Web application, worker processes, API services, shared libraries.

## Environments
- Development: Isolated per engineer with feature branches, seeded data only.
- Staging: Production-parity infrastructure with synthetic and masked datasets.
- Production: Multi-AZ deployment with hardened network boundaries and WAF.

## Data Classes
- Customer personal information (PII) and sensitive identification documents.
- Financial account and transaction records (confidential).
- Audit logs and operational telemetry (restricted internal).

## Multi-Factor Authentication
- Identity Provider: Okta Workforce Identity Cloud.
- MFA Posture: Enforced for all privileged roles with WebAuthn + TOTP fallback.

## Authorization Model
- Role-based access control (RBAC) with least-privilege role design.
- Attribute checks on transaction approvals and investor risk flags.

## Logging and Monitoring
- Centralized OTEL collector with retention aligned to PSPF.
- Immutable audit trail streamed to append-only storage.

## Supplier Management
- Annual assessment of critical SaaS vendors and CSP shared responsibility matrix.
- Contracts mandate compliance attestations (SOC2 Type II / ISO 27001).

## Vulnerability Management
- Weekly SCA/SAST scans with triage SLA (critical: 48h, high: 7d).
- Quarterly penetration testing and red-team exercises.

## Change Management
- Git-based change control with mandatory reviews and CI gating.
- Infrastructure changes tracked via IaC pull requests with CAB approval.

## Incident and Breach Handling
- 24/7 on-call rotation with OAIC-aligned notification workflows.
- Root cause analysis with corrective action tracking in Jira.

## Backup and Disaster Recovery
- Automated nightly backups with 35-day retention and quarterly restores tests.
- DR playbook for region-level failover validated semi-annually.
