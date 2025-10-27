# Operational Runbooks (Draft Outline)

## Deployment
1. Validate service health checks via `pnpm test --filter <service>`.
2. Promote container images from staging ECR to production ECR.
3. Apply infrastructure changes through Terraform in `apgms/infra` with workspace targeting.
4. Monitor rollout with synthetic probes and dashboards.

## Rollback
1. Identify failing release (timestamp, git SHA).
2. Trigger automated rollback pipeline to previous artefact version.
3. Flush message queues where safe; replay events if required.
4. Document incident in postmortem template and link to traceability matrix.

## Incident Response
- **Detection**: Alerts via Prometheus Alertmanager on SLA breaches, error rate anomalies, or missing telemetry.
- **Diagnosis**: Use OpenTelemetry traces, structured logs, and Grafana dashboards to isolate failing service.
- **Mitigation**: Apply feature flags, scale affected service, or execute rollback procedure.
- **Communication**: Update status page and notify stakeholders via runbook steps.

## Compliance Exports
1. Run scheduled export job in `apgms/services/audit`.
2. Verify checksum and signature before delivery to regulators.
3. Store immutable copy in `sbr` repository with retention policy.
4. Capture evidence in audit trail dashboard.

> Detailed service-specific runbooks remain TODO until instrumentation and automation tasks are completed.
