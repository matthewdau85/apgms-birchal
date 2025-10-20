# OSF Security Questionnaire (Draft Responses)

This working copy captures prepared answers for the Operating Security Framework (OSF) questionnaire. Hyperlinks reference evidence that can be shared with assessors.

## Product Overview

- **Service description** – APGMS ingests banking line items and surfaces reconciliation workflows for regulated entities.
- **Hosting regions** – Primary workloads operate in AWS ap-southeast-2 with disaster recovery in ap-southeast-4.
- **Data categories** – Bank transaction metadata, customer contact details, and operational audit trails (see [PRIVACY.md](./PRIVACY.md)).

## Access Controls

- **Identity provider** – Workforce SSO is provided by the corporate IdP with enforced MFA. Details in [SECURITY.md](./SECURITY.md#identity-and-mfa-via-identity-provider).
- **Least privilege** – Access reviews and token revocation steps are documented in the lifecycle section of [SECURITY.md](./SECURITY.md#identity-and-mfa-via-identity-provider).
- **Third-party access** – Partner origin onboarding requires change approval; see [SECURITY.md](./SECURITY.md#cors-allowlist-management).

## Secure Development Lifecycle

- **CI pipelines** – Build and unit tests run in [ci.yml](../.github/workflows/ci.yml). End-to-end flows run on demand via [e2e.yml](../.github/workflows/e2e.yml). Security scanners are defined in [security.yml](../.github/workflows/security.yml).
- **Threat modelling** – Architecture artefacts in [ASVS-MAP.md](./ASVS-MAP.md) and [docs/architecture/README.md](./architecture/README.md) guide the review checklist.
- **Dependency management** – CVE triage follows the “continuous improvement” workflow in [SECURITY.md](./SECURITY.md#continuous-improvement).

## Incident Response and Privacy

- **NDB process** – The OAIC notification flow and 30-day timer are defined in [PRIVACY.md](./PRIVACY.md#notifiable-data-breach-ndb-runbook).
- **Operational response** – Runbook hand-offs and escalation contacts reside in [docs/ops/runbook.md](./ops/runbook.md).
- **Evidence storage** – Templates and screenshot placeholders are tracked in [docs/evidence/README.md](./evidence/README.md).

## Outstanding Actions

- Record planned remediation for ASVS gaps noted in [ASVS-MAP.md](./ASVS-MAP.md) prior to final submission.
- Capture production MFA enforcement screenshots and upload them to [`docs/evidence/`](./evidence/README.md) for assessor review.
