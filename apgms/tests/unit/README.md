# Unit tests

Store fast, isolated tests in this directory. Each package should mirror its source
structure, for example `tests/unit/shared/db.test.ts` to cover `shared/src/db.ts`.

Guidelines:

* Mock network and database access; unit tests must not require external services.
* Prefer factories from `shared/test` to avoid fragile fixtures.
* Co-locate coverage configuration (Vitest/Jest) with the tests and export the report to
  `../../coverage` so the CI coverage gate can aggregate the results.
