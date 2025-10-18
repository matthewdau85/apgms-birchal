# Notifiable Data Breach (NDB) Runbook

## 1. Detection and triage
- Confirm the suspected breach, capture affected services, and open an incident ticket.
- Activate the incident commander and security lead within 15 minutes of confirmation.
- Preserve forensic evidence (logs, database snapshots) before containment actions.

## 2. Containment
- Revoke exposed credentials and rotate secrets using `scripts/key-rotate.ps1`.
- Disable compromised API keys or connectors and apply firewall blocks as required.
- Patch vulnerable services and redeploy hardened containers signed by the current pipeline.

## 3. Assessment
- Determine the categories of personal information involved using `docs/privacy/pii-inventory.csv`.
- Establish the breach window, root cause, and number of affected records.
- Evaluate the likelihood of serious harm following OAIC guidance.

## 4. Notification
- If notification is required, prepare statements for OAIC and impacted customers.
- Include remediation steps, key dates, and references to SBOM and SCA artifacts from the Security workflow run.
- Coordinate with legal and communications before distribution.

## 5. Remediation and lessons learned
- Track follow-up tasks in the incident ticket until verified complete.
- Schedule a post-incident review within five business days to capture control gaps.
- Update this runbook, the security workflow allowlist, and OSF questionnaire evidence as needed.
