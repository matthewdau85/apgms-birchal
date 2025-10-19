# Operational Monitoring

The public status site publishes real-time availability metrics sourced from Grafana Cloud. Key dashboards include:

- **API Gateway overview:** Rate-limit utilisation, authentication failure counts, and latency percentiles exported from Fastify metrics.
- **Webhook reliability:** Delivery success rate, replay detections, and downstream connector response times.
- **Database health:** Connection pool saturation, replica lag, and backup completion timestamps.

Synthetic probes ping the `/health` endpoint every 30 seconds using the `X-Health-Check-Key`. Any failure raises PagerDuty incident `PD-APGMS-GATEWAY`. Historical incidents and remediation notes are archived under `status/incidents/`.
