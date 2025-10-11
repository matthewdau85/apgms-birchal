# DSP & OSF Alignment

This document connects the APGMS platform backlog to the Delivery & Service Performance (DSP) goals and the Operating Service Framework (OSF) controls that govern the product.

## DSP Objectives and Key Metrics

| Objective | Metric | Current Baseline | Target |
| --- | --- | --- | --- |
| Reliable ledger ingestion | API gateway `/bank-lines` success rate | Placeholder (service not yet deployed) | ≥ 99.5% success per rolling 7 days |
| Responsive APIs | P95 latency for Fastify endpoints | Not instrumented | ≤ 300 ms under nominal load |
| Accurate reconciliation | Percentage of bank lines reconciled by automated jobs (`apgms/worker`) | Worker not yet implemented | ≥ 85% automated reconciliation |
| Transparent operations | Time to publish incident notice on status site (`apgms/status`) | Status site placeholder | ≤ 30 minutes from detection |

Actions to establish baselines:
- Instrument Fastify routes with latency metrics once observability libraries are added.
- Add synthetic monitoring that exercises `/health` and `/bank-lines` endpoints to capture availability.
- Define reconciliation workflows in the worker service and record automation coverage in runbook appendices.

## OSF Governance Checkpoints

| Control Area | Expectation | Implementation Notes |
| --- | --- | --- |
| Change Management | All production changes require pull request review and CI validation. | Enforce branch protection rules and ensure `pnpm -r test` covers new services before rollout. |
| Security & Privacy | Threat modelling and dependency scanning in place before go-live. | `docs/security/README.md` now documents required reviews; integrate SAST/DAST into CI. |
| Incident Response | On-call rotation with documented escalation within runbook. | `docs/ops/runbook.md` captures roles and contact channels; needs automation for paging. |
| Service Reporting | Quarterly service review summarising DSP metrics. | Export metrics to reporting dashboards referenced in runbook appendices. |
| Compliance | Maintain artefacts for WCAG, data handling, and audit requirements. | Accessibility and security docs now specify evidence repositories under `apgms/docs/`. |

## Mapping Backlog Items to DSP/OSF Requirements

| Backlog Theme | Key Stories | DSP/OSF Link |
| --- | --- | --- |
| Authentication enablement | Add user login, session handling, and role-based access around `/users` endpoint. | Supports Security control (access management) and Reliable ledger ingestion (prevents unauthorised data access). |
| Observability stack | Add request metrics, distributed tracing, and alerting for Fastify and FastAPI services. | Enables Responsive APIs metrics and Incident Response readiness. |
| Automated reconciliation | Implement background jobs in `apgms/worker` and persistence for reconciliation state. | Directly drives Accurate reconciliation metric; requires change management and compliance documentation. |
| Terraform infrastructure | Flesh out modules under `apgms/infra/iac` for managed Postgres/Redis, network policies, and secrets. | Addresses OSF compliance (infrastructure governance) and provides foundation for service reporting. |
| Status communications | Build static site generator in `apgms/status` with templated incident posts. | Delivers Transparent operations objective and supports Incident Response control. |

## Compliance Evidence Sources

- Accessibility testing results: `apgms/docs/accessibility/report.md`.
- Security threat models and control mappings: `docs/security/README.md` and `apgms/docs/security/ASVS-mapping.md`.
- Architecture updates and decision records: `docs/architecture/README.md` (with future ADRs stored alongside).
- Operational readiness artefacts: `docs/ops/runbook.md` and linked monitoring dashboards.
