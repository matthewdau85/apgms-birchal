# Gateway On-Call Runbook

## Escalation Policy
1. Primary on-call (rotation in PagerDuty schedule `gateway-sre-primary`).
2. Secondary on-call (PagerDuty schedule `gateway-sre-secondary`).
3. Engineering manager (`@gateway-eng-manager`) for incidents exceeding 30 minutes or impacting >10% traffic.
4. Director of Platform Engineering for Sev1 incidents or when customer commitments are at risk.

Escalate immediately if:
* The synthetic check fails twice in a row.
* Error budget burn rate alert exceeds 4x.
* Regulatory reporting integrations are affected.

## Key Dashboards
* **Gateway Overview** – `Grafana > Gateway > 01-Overview`: latency percentiles, availability, deployment markers.
* **Dependency Health** – `Grafana > Gateway > 02-Dependencies`: upstream/downstream response times, saturation.
* **Synthetic Monitors** – `Grafana > Gateway > 03-Synthetics`: `/readyz` and `/bank-lines` timings plotted with regions.
* **Logging** – `Kibana > gateway-*` search filtered by `severity>=error` and `trace_id` from alert.

## First Response Checklist
1. **Acknowledge the page** in PagerDuty and announce in `#gateway-incident`.
2. **Review dashboards**:
   * Confirm latency and error rates on the Overview dashboard.
   * Check dependency dashboard for correlated spikes.
3. **Inspect synthetic logs** in the latest GitHub Actions artifact to validate failure context.
4. **Check recent deploys** via the deployment marker panel; roll back if the issue aligns with a release.
5. **Gather logs** in Kibana filtered by customer impact or trace IDs from the alert payload.
6. **Mitigation steps**:
   * Restart unhealthy pods via the Kubernetes runbook if readiness checks failing.
   * Redirect traffic to the standby region if the primary region is impacted.
   * Throttle partner traffic using API gateway rate-limits if necessary to preserve core flows.
7. **Communicate** updates every 15 minutes in `#gateway-incident` and update the status page if required.
8. **Post-incident**: create an incident timeline, capture customer impact, and file a postmortem within 48 hours.

## Useful Commands
```
# Check readiness of pods
kubectl get pods -l app=gateway -o wide

# Tail logs for a specific pod
kubectl logs deploy/gateway -c app --since=10m

# Trigger synthetic check locally (requires VPN)
./scripts/synthetic.sh https://gateway.prod.example.com "Authorization: Bearer <token>"
```
