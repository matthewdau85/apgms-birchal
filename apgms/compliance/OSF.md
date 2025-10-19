# Operational Security Framework Questionnaire

## 1. Organization & Contacts
- **Security Contact:** security@apgms.example
- **Incident Commander Escalation:** +61 1800 000 000
- **Change Advisory Board Chair:** cab@apgms.example

## 2. Asset Inventory
- Production services enumerated in `docs/ARCHITECTURE.md`.
- CMDB source: `infra/cmdb.yaml`.

## 3. Access Controls
- SSO via Okta; MFA required for all workforce identities.
- Privileged elevation governed by `runbooks/privileged-access.md`.

## 4. Vulnerability Management
- Monthly authenticated scanning (SCA report).
- Critical CVEs patched within 3 business days.

## 5. Secure Development Lifecycle
- Threat modeling checklist (`docs/security/threat-model.md`).
- Mandatory PR security review for services touching PII.

## 6. Incident Response
- Follow `runbooks/ndb.md` for notifiable breaches.
- PagerDuty rotation documented in `docs/ops/oncall.md`.

## 7. Business Continuity
- DR exercises biannually; evidence stored in `artifacts/dr-plan.pdf`.

## 8. Compliance Evidence Links
| Artifact | Location |
|----------|----------|
| SBOM | `artifacts/sbom.json` |
| Software Composition Analysis (SCA) | `artifacts/sca-report.csv` |
| Red-team Report | `artifacts/redteam-findings.pdf` |
| Golden Build Validation | `artifacts/golden-image-checklist.xlsx` |
| OTEL Telemetry Dump | `artifacts/otel-export.ndjson` |

## 9. Sign-off
- Security Lead signature:
- Date:
