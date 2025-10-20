# Evidence Catalogue (Placeholders)

Store final artefacts and screenshots referenced by the assurance documents here. Replace the placeholder filenames once evidence is captured.

| Control Area | Expected Artefact | Placeholder Path |
| --- | --- | --- |
| MFA enforcement | Screenshot of IdP policy showing mandatory MFA | `./mfa-policy.png` |
| Rate limiting | Graph of throttle events or k6 report output | `./rate-limit-report.png` |
| CORS allowlist | Deployment log confirming origin list | `./cors-allowlist-log.txt` |
| Security headers | HTTP response capture with headers highlighted | `./api-headers.har` |
| NDB communication | Template email/pdf sent to customers | `./ndb-template.pdf` |

Upload artefacts using Git LFS if they exceed repository size guidelines. Reference these paths from [SECURITY.md](../SECURITY.md), [PRIVACY.md](../PRIVACY.md), and [OSF-QUESTIONNAIRE.md](../OSF-QUESTIONNAIRE.md) to keep evidence discoverable.
