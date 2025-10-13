# DSP OSF evidence index

## Policy version control

All security, privacy, and operational policies live in this repository under `docs/`. Every document includes front-matter with the owning team, last review date, and applicable ASVS controls. Changes to policy files require:

- Pull request approval from the policy owner and security lead.
- Inclusion in the quarterly document review checklist automated via GitHub scheduled workflows.
- An update to `docs/dsp-osf/change-log.md` capturing revision summaries for audit traceability.

## ASVS cross-reference matrix

| ASVS control | Evidence location | Notes |
| --- | --- | --- |
| V1.1 – Secure SDLC | `/docs/security/sdlc.md` | Includes training records and threat modelling templates. |
| V2.4 – Authentication | `/docs/security/authentication.md` | References internal mTLS/JWT design and key rotation schedule. |
| V4.1 – Access control | `/docs/security/access-control.md` | Documents RBAC matrices and review cadence. |
| V7.1 – Error handling | `/docs/ops/runbook.md` | Contains circuit breaker and rollback procedures. |
| V10.2 – Data protection | `/docs/privacy/data-handling.md` | Maps classifications to storage/retention requirements. |
| V14.4 – Logging & monitoring | `/docs/ops/observability.md` | Details Prometheus, Grafana, and alert runbooks. |

The matrix exports automatically via the compliance evidence tooling and is included with every ATO submission pack.
