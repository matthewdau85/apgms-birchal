# DSP-OSF Compliance Policies

The Digital Service Provider Operational Security Framework (DSP-OSF) policies below document how the APGMS platform meets regulatory expectations for operational resilience and data security.

## Governance & Accountability

- **Policy Owner**: Chief Information Security Officer (CISO).
- **Review Cadence**: Semi-annual review with change control sign-off by the Risk Committee.
- **Documentation**: Policies published in the internal Confluence space `Risk & Compliance > DSP-OSF`.

## Risk Management

1. Maintain an up-to-date risk register with likelihood/impact scoring.
2. Run quarterly scenario exercises covering cyber, availability, and supplier failure.
3. Report key risk indicators to the Risk Committee monthly.

## Access Control

- Enforce least privilege using role-based access controls in all systems.
- Rotate privileged credentials every 90 days via Hashicorp Vault.
- Require MFA for all workforce identities and partner banks.

## Change Management

- All changes must pass automated testing and peer review before merge.
- Emergency changes require retrospective approval within 24 hours.
- Deployment history retained for 12 months in the release registry.

## Incident Management

- Follow the [Operations Runbook](../ops/runbook.md) for detection and response.
- Notify regulators within required timeframes (e.g., 72 hours for major incidents).
- Conduct post-incident reviews to capture lessons learned.

## Business Continuity & Disaster Recovery

- Maintain hot-warm redundancy across two regions.
- Test failover semi-annually and document outcomes in the Evidence Index.
- Ensure RTO ≤ 4 hours and RPO ≤ 1 hour for critical services.

## Data Protection & Privacy

- Classify data assets and enforce encryption in transit and at rest.
- Conduct Data Protection Impact Assessments for high-risk processing.
- Honour data subject requests within 30 days.

## Supplier Management

- Perform due diligence before onboarding suppliers; review annually.
- Require SLAs that align with platform SLOs and security obligations.
- Track subcontractor use and ensure contractual compliance.

