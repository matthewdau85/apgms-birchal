# OSF Security Questionnaire

## Product overview
- Provide a concise description of the service, including core features, target users, and data sensitivity classification.
- Summarise deployment architecture, primary integrations, and data residency.

## Hosting & supplier mgmt
- Detail hosting environments (cloud regions, data centres) and the shared responsibility model.
- List critical third-party suppliers and the controls in place for onboarding, review, and exit.
- Reference supplier risk assessments or SOC reports where applicable.

## MFA posture
- Describe current multi-factor authentication coverage for internal and customer-facing systems.
- Note enforcement mechanisms, exceptions, and roadmap items.
- Link to evidence demonstrating MFA configuration validation or monitoring.

## Logging/Monitoring
- Explain log collection scope, retention, and storage security.
- Identify monitoring tools, alert thresholds, and on-call coverage.
- Provide references to `/SECURITY.md` and `/compliance/asvs_map.csv` for control mappings.

## Incident mgmt (NDB linkage)
- Outline the incident response process, escalation paths, and communications plan.
- Describe how Notifiable Data Breach (NDB) obligations integrate with incident handling.
- Link to `/runbooks/ndb.md` for detailed procedures.

## Change mgmt
- Summarise change approval workflows, CAB cadence, and emergency change handling.
- Include deployment gating controls and rollback strategies.

## SDLC controls
- Document secure development lifecycle practices, including threat modeling, code review, and security testing.
- Reference tooling coverage (SAST/DAST/IAST) and remediation SLAs.

## SBR/AS4 approach
- Describe SuperStream Business to Business Reporting (SBR) and AS4 channel handling.
- Provide integration architecture, security controls, and compliance status.
