# Automated testing & CI prompts

Use the following prompts when working with LLM copilots or documenting manual QA steps.
They emphasise the minimum expectations for coverage, migration safety, and operational
confidence.

## Unit tests

> Review the module and propose unit tests that:
> * cover success and failure branches for validation logic;
> * mock external dependencies so the tests run in isolation;
> * emit coverage reports to the workspace `coverage/` directory so the CI coverage gate can
>   track regressions over time.

## Integration tests

> Audit our integration suite and suggest scenarios that validate database migrations,
> scheduled jobs, and reporting pipelines. Include setup/teardown steps that work in CI.
> Confirm both forward and backward migration paths so the migration gate can block unsafe
> schema changes.

## Contract tests

> Generate consumer-driven contract tests for our public APIs. Highlight required fields,
> optional fields, and error codes. Ensure the provider verification step can run as part of
> `pnpm -r test` so pull requests catch breaking changes before they merge.

## End-to-end tests

> Identify the minimal smoke journeys that prove the platform works after deployment. Tag
> the scenarios with `@smoke` and add notes for ops responders describing the expected
> outputs (screenshots, JSON payloads, logs) so they can triage incidents quickly.
