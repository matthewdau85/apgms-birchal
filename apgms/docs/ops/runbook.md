# Ops runbook

## On-call checklist

- Confirm pager contactability in PagerDuty before a scheduled rotation.
- Ensure access to production Kubernetes cluster and logging backends (Loki/Grafana or Cloud Logging).
- Verify OTEL collector endpoint availability; if telemetry is disabled the service still functions but traces will be absent.

## 1. Detection and triage

1. **Alerts** – primary alerts originate from:
   - Kubernetes readiness probe failures on `/readyz` (Pod transitions to `Unready`).
   - Synthetic API checks reporting latency or error-rate regressions.
   - Database connectivity alarms raised by Prisma error logs.
2. **Immediate actions** – acknowledge the alert, open a shared incident document, and capture current timestamp.
3. **Status** – post a preliminary incident note in `#on-call` and external status pages if customer-facing impact is confirmed.

## 2. Diagnosis

1. **Service health** – run:
   ```sh
   kubectl get pods -l app=api-gateway
   kubectl describe pod <pod-name>
   ```
   Focus on readiness probe history and recent restarts.
2. **Health endpoints** – from a bastion or port-forwarded terminal execute:
   ```sh
   curl -sf http://<pod-ip>:3000/healthz
   curl -sf http://<pod-ip>:3000/readyz || echo "not ready"
   ```
   - `healthz` returning 200 indicates the process is alive.
   - `readyz` returning 503 usually signals database connectivity issues or an in-progress shutdown.
3. **Logs** – query centralized logging for the request ID referenced by probes:
   - Structured logs now include `req_id`, `latency_ms`, and (when tracing is enabled) `trace_id`/`span_id` fields.
   - Use filters such as `json.service="api-gateway" json.req_id="<value>"`.
4. **Telemetry** – if OTEL is configured, open the tracing backend and search for `service.name = api-gateway` spans using the `trace_id` from logs.
5. **Database** – check connectivity:
   ```sh
   pnpm --filter @apgms/api-gateway exec npx prisma db execute --stdin <<'SQL'
   SELECT 1;
   SQL
   ```
   Failures confirm a database outage blocking readiness.

## 3. Mitigation

1. **Roll pods** – when pods are wedged, drain gracefully:
   ```sh
   kubectl rollout restart deployment/api-gateway
   ```
   The deployment uses `/readyz` for readiness and a `preStop` hook plus 45s termination grace to honour the graceful shutdown handler.
2. **Database outage** – coordinate with the database team; do not restart pods repeatedly. Once connectivity is restored pods will transition to Ready automatically.
3. **Hotfix** – if application regression is suspected, use blue/green deployment by overriding `api_gateway_image` in Terraform and reapplying.

## 4. Post-incident

1. Capture a timeline with request IDs, trace IDs, and user impact.
2. File a retrospective ticket within 24 hours with action items.
3. Update this runbook if additional mitigation steps were required.

## References

- Deployment manifest: `infra/dev/kubernetes/api-gateway-deployment.yaml`
- Terraform definition: `infra/iac/main.tf`
- Telemetry configuration: environment variable `OTEL_EXPORTER_OTLP_ENDPOINT`
