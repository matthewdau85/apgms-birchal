# Operations Runbook

The operations runbook describes the procedures required to keep the APGMS platform healthy. Commands use repository-relative paths and assume access to the production Kubernetes cluster via `kubectl` and the shared observability stack.

## Service Overview

| Service | Deployment | Critical SLO |
| --- | --- | --- |
| API Gateway | `services/api-gateway` | <250 ms p95 latency, 99.9% availability |
| Audit Service | `services/audit` | 100% event persistence |
| Payments Service | `services/payments` | <1 h reconciliation delay |
| Registries Service | `services/registries` | <500 ms lookup latency |

## Daily Checks

1. Verify on-call rotation and incident contact numbers in PagerDuty.
2. Review overnight alerts in Grafana (dashboard `APGMS/Operations`).
3. Confirm Kafka consumer lag < 200 messages across all topics:
   ```bash
   kubectl -n platform exec deploy/kafka-exporter -- kafka-consumer-groups --bootstrap-server kafka:9092 --all-groups --describe
   ```
4. Inspect error budgets via SLO dashboard:
   ```bash
   kubectl -n observability port-forward svc/grafana 3000:3000
   ```

## Deployment Procedure

1. Confirm change has passed automated checks:
   ```bash
   npm run lint && npm test
   ```
2. Tag release and push:
   ```bash
   git tag -a v<version> -m "Release <version>"
   git push origin v<version>
   ```
3. Trigger CI/CD pipeline (GitHub Actions `release.yaml`).
4. Monitor rollout:
   ```bash
   kubectl -n platform rollout status deploy/api-gateway
   kubectl -n platform get pods -w
   ```
5. Validate customer journey with smoke tests:
   ```bash
   npm run smoke:test -- --env production
   ```

## Incident Response

1. Declare incident in Slack `#incidents` and open PagerDuty incident.
2. Capture timeline in shared doc (`/runbooks/incidents/<date>-<summary>.md`).
3. Collect diagnostics:
   ```bash
   kubectl -n platform logs deploy/api-gateway --since=30m
   kubectl -n platform logs deploy/payments --since=30m
   kubectl -n platform describe pod <pod-name>
   ```
4. Mitigate using documented playbooks (e.g. failover to secondary database with `terraform apply -target=module.db.failover`).
5. After resolution, schedule post-incident review within 48 hours.

## Backup & Restore

- **Database backups** run hourly via `pgBackRest` and are stored in S3 bucket `s3://apgms-backups/`. Validate backups weekly:
  ```bash
  kubectl -n platform exec statefulset/postgres -- pgbackrest info
  ```
- **Kafka snapshots** are captured nightly. Restore procedure:
  ```bash
  kubectl -n platform exec job/kafka-restore -- ./restore.sh --topic <topic> --timestamp <epoch>
  ```

## Compliance Evidence Capture

Run the evidence linking script after each release to refresh compliance records:
```bash
python docs/dsp-osf/update_evidence_index.py --artifacts-dir .github/artifacts
```

