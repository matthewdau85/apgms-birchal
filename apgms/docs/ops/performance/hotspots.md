# Follow-up issues from traffic & profiling review

The mock-traffic snapshot exposed a couple of areas that warrant further work before we run the same instrumentation against production datasets.

1. **POST `/bank-lines` exceeds 50 ms on average (p95 ≈ 56 ms).** Investigate the Prisma insert path and the synchronous enrichment work (checksum loop) so we can reduce tail latency for intake bursts. Options include moving heavy transforms to a worker or precomputing values before insert. 【F:services/api-gateway/metrics/mock-run/summary.json†L13-L39】
2. **GET `/bank-lines` spends ~33 ms per call (p95 ≈ 38 ms).** Profile the query plan once a real Postgres instance is available—likely needs an index on `date DESC` plus caching or pagination tuning to hold latency under 25 ms. 【F:services/api-gateway/metrics/mock-run/summary.json†L9-L33】
3. **Capture real traffic by enabling the metrics collector in non-mock environments.** Ship the `MetricsCollector` hooks with configurable output (e.g., OTLP exporter) so we can validate these findings against production traffic instead of the synthetic load. 【F:services/api-gateway/src/app.ts†L96-L152】【F:services/api-gateway/src/metrics.ts†L1-L104】

Each item should be tracked in the issue tracker with acceptance criteria covering latency targets and verification steps using the new instrumentation.
