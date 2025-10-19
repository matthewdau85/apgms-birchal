# Automated Testing Overview

This workspace distinguishes four layers of automated testing so that coverage gaps and
ownership are immediately obvious:

| Layer        | Purpose                                                                | Primary owners |
| ------------ | ---------------------------------------------------------------------- | -------------- |
| Unit         | Validate isolated functions, schema helpers, and adapters.             | Service teams  |
| Integration  | Exercise modules against shared infrastructure (DB, queues, services). | Platform team  |
| Contract     | Prevent breaking downstream consumers through schema drift.            | API gateway    |
| End-to-end   | Rehearse user journeys and run smoke tests before deploys.             | QA / Ops       |

Each test layer has a dedicated folder under this directory. Populate each folder with a
`README.md` that explains the local conventions and add test files using the framework
that best suits the owning team (Vitest/Jest for TypeScript, Playwright for browser
scenarios, k6 for load validation, etc.).

## Coverage and gates

* **Coverage gate** – repositories that emit coverage reports should export them to the
  workspace root `coverage/` directory. The CI pipeline can then fail the build when the
  aggregated coverage drops below the configured threshold. For TypeScript services this
  typically means running `pnpm vitest --coverage` inside each package and exporting the
  report.
* **Migration gate** – database migrations must run inside `pnpm -r test` during CI so we
  catch incompatibilities early. Place migration smoke tests inside `tests/integration`
  to confirm schema changes can roll forward and backward.

## Dedicated suites

* **Reports** – add report generation regression tests under `tests/integration/reports`.
  Tests should verify expected CSV/JSON shapes and ensure totals reconcile against seed
  data.
* **Ops runbooks** – use `tests/e2e/ops` for operational checklists. Each test should
  reference the corresponding playbook in `docs/ops` so new responders can link symptoms
  to mitigations.

## Running the suite locally

```bash
pnpm install
pnpm -r test
pnpm -w exec playwright test   # optional e2e smoke
```

Add package specific commands (for example `pnpm --filter api-gateway test`) to the
service `README` files so engineers know how to execute focused suites.
