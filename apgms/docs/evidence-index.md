# Security and compliance evidence index

This index summarises the primary artifacts that demonstrate control coverage for
APGMS. Each entry lists the control domains addressed, the owning team, the update
cadence and direct links to the source material in this repository.

| Artifact | Domain coverage | Owner | Update cadence | Location |
| --- | --- | --- | --- | --- |
| OSF security questionnaire draft | External security questionnaires, due diligence responses | Security & Legal | Monthly during security council | [docs/OSF-questionnaire-draft.md](./OSF-questionnaire-draft.md) |
| OWASP ASVS control map | Application security controls, verification status | Security Engineering | Bi-weekly backlog refinement | [docs/ASVS-control-map.csv](./ASVS-control-map.csv) |
| TFN Security SOP | Incident response, escalation, regulatory reporting | Security Operations | After every incident or exercise | [docs/security/TFN-SOP.md](./security/TFN-SOP.md) |
| Operations runbook | Deployment, monitoring, operational readiness | Platform Engineering | Quarterly or after process change | [docs/ops/runbook.md](./ops/runbook.md) |
| Risk register | Enterprise risk management, mitigation tracking | Risk & Compliance | Monthly risk committee | [docs/risk/register.md](./risk/register.md) |
| DPIA | Privacy impact, data inventory, lawful bases | Privacy Office | Annual review or upon product change | [docs/privacy/dpia.md](./privacy/dpia.md) |
| Partner bank packet | Vendor due diligence, contractual assurances | Partnerships | Upon onboarding or contract renewal | [docs/partners/bank-packet.md](./partners/bank-packet.md) |
| Grafana dashboards | Observability baselines, SLO monitoring | SRE | With each SLO change | [infra/observability/grafana/dashboards.json](../infra/observability/grafana/dashboards.json) |
| K6 debit path scenario | Resilience testing, business continuity | Platform Engineering | Quarterly game day | [k6/debit-path.js](../k6/debit-path.js) |
| Architecture overview | System design, trust boundaries, data flow | Architecture Guild | Quarterly or after major change | [docs/architecture.md](./architecture.md) |

> For documents that include personal data or regulator-facing content, consult the
> document owners before sharing outside the security council.
