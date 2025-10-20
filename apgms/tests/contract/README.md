# Contract tests

Contract tests protect downstream consumers from breaking API or event schema changes.
Place consumer-driven contract definitions in this directory. Pact files and JSON schema
snapshots can live alongside the test files.

Guidelines:

* Keep provider verification tests in the owning service (for example the API gateway).
* Document consumer expectations in `docs/partners/` and link back to the matching contract
  test for traceability.
* Publish contract artifacts as CI build outputs so partner sandboxes can pull them during
  their own verification.
