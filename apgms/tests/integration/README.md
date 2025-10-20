# Integration tests

Integration tests exercise modules against shared infrastructure: databases, queues,
external services, and scheduled jobs. Use subfolders to group suites by capability, such
as `reports/`, `ops/`, or `migrations/`.

Guidelines:

* Spin up dependencies with Docker Compose or ephemeral containers referenced from the
  service `docker-compose.yml` file.
* Include idempotent setup/teardown scripts so the tests can run in CI and locally without
  manual intervention.
* When validating migrations, assert both forward and backward compatibility to satisfy the
  migration gate in CI.
