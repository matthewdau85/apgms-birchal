# End-to-end tests

End-to-end tests capture critical user journeys (sign in, reconciliation, reporting) and
operational smoke tests. Playwright is the default harness for browser automation, but you
can add CLI based workflows when a UI is not required.

Guidelines:

* Tag smoke scenarios with `@smoke` so the CI workflow can run a fast subset on each PR.
* Store shared selectors and helpers inside `webapp/src/test-utils` to avoid duplication.
* When a scenario maps to an ops procedure, link to the relevant playbook in
  `docs/ops/runbook.md`.
