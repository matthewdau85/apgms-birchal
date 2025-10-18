# Testing and Observability Strategy

## 1. Current Inventory

### Source Repositories
- `apgms/tests/contract`: Contract test stubs.
- `apgms/tests/e2e`: Browser-driven end-to-end scenarios powered by Playwright.
- `apgms/services/*/test`: Service-level unit and integration tests (varying coverage).
- `apgms/k6`: Performance test harness using k6.
- `apgms/infra`: Terraform modules and provisioning scripts with limited validation tests.
- `apgms/docs`: Documentation stubs; no comprehensive test guidance yet.

### Tooling & Pipelines
- Local `pnpm test` scripts defined per package.
- Shared Playwright configuration in `apgms/playwright.config.ts`.
- No unified CI pipeline or coverage aggregation is currently configured in-repo.
- Observability tooling (metrics, tracing, logs) is largely ad-hoc per service.

## 2. Proposed Test Strategy

| Layer | Scope | Tools | Ownership |
| --- | --- | --- | --- |
| Unit | Module-level logic within each service | Jest (Node), pytest (Python connectors), Go test (Go services) | Service teams |
| Integration | Service API with internal dependencies (DB, queues) | Jest + Testcontainers, supertest; pytest w/ docker-compose | Service teams |
| Contract | Provider/consumer interface tests | Pactflow via `apgms/tests/contract` | Platform QA |
| End-to-End | Cross-service journeys (user onboarding, payment flows) | Playwright, mocked third parties | Platform QA |
| Performance | Non-functional SLA validation | k6, Gatling (future) | SRE |
| Observability Verification | Telemetry schema, alert coverage | OpenTelemetry collectors, log schema validators | SRE + QA |

## 3. Implementation Roadmap

1. Harmonise test runners per service and ensure `pnpm test` invokes the correct suite.
2. Build reusable docker-compose profiles for integration tests.
3. Expand Playwright coverage to include payment capture, reconciliation, and tax filing journeys.
4. Leverage k6 scripts for load/perf against deployed staging environment.
5. Introduce telemetry validation harness (OpenTelemetry collector w/ assertions).
6. Capture coverage metrics using `nyc` (JS), `coverage.py` (Python), and Go `cover`.

## 4. Observability Enhancements

- Adopt OpenTelemetry SDK across services with consistent resource attributes.
- Emit domain-specific metrics (latency, SLA, error budgets) via Prometheus exporters.
- Enforce structured JSON logging with correlation IDs across services.
- Define tracing expectations for cross-service flows (trace spans for API gateway → tax engine → payments → registries).
- Create automated checks ensuring telemetry is generated in integration environments.

## 5. Documentation & Traceability

- Maintain architecture diagrams under `apgms/docs/architecture/`.
- Create API reference docs sourced from OpenAPI specs.
- Draft operational runbooks covering deployment, rollback, monitoring, and incident response.
- Link patent claim IDs to features and validating tests via a traceability matrix.

## 6. Outstanding Gaps

- Automated CI pipelines remain unimplemented pending GitHub Actions or GitLab runners.
- Cross-service test coverage is partial; requires dedicated time to add scenarios and fixtures.
- Observability instrumentation has not yet been standardised in code; placeholders only.
- Traceability matrix requires alignment with legal/patent documentation.

> **Note:** This document establishes the baseline strategy and highlights the additional engineering work needed to fully satisfy the patent-aligned testing requirements.
