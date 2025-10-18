# Database Operations

This document describes how to work with the Prisma/PostgreSQL database that powers APGMS. It covers migrations, seeding, backups, and restores.

## Prerequisites

* PostgreSQL 14+ client tools available on your PATH (`psql`, `pg_dump`, `pg_restore`).
* A valid `DATABASE_URL` pointing at the target environment.
* Node.js 18+ and PNPM 9+.

## Migrations

Generate, apply, and validate migrations through the workspace scripts:

```bash
pnpm db:generate        # regenerate Prisma client from the schema
pnpm db:migrate:dev     # create & apply a new migration in development
pnpm db:migrate:deploy  # apply existing migrations to the target database
pnpm db:migrate:status  # inspect migration status for the target database
pnpm db:validate        # ensure schema.prisma and migrations are in sync
```

The CI workflow executes `pnpm db:generate` and `pnpm db:validate` on every push to guarantee that the checked-in Prisma client and migration history stay aligned.

## Seeding baseline data

The repository includes a resilient seed routine that uses retry/backoff logic and connection pooling (see `scripts/seed.ts`). Run it after provisioning a new database:

```bash
pnpm db:seed
```

The seed routine is idempotent. It upserts orgs and users and skips duplicate bank-line entries so you can safely run it multiple times.

## Backups

Use the helper script to capture compressed backups via `pg_dump`:

```bash
DATABASE_URL=postgres://user:pass@host:5432/db \
  bash scripts/db/backup.sh [output-directory]
```

If no output directory is provided the script writes to `./backups`. The resulting file is compatible with `pg_restore`.

## Restores

Restore a backup with:

```bash
DATABASE_URL=postgres://user:pass@host:5432/db \
  bash scripts/db/restore.sh path/to/backup.dump
```

The script drops existing objects before restore to guarantee a clean state. Always confirm the target database before running a restore.

## Connection management

`shared/src/db.ts` configures Prisma with retry/backoff logic and appends connection pooling parameters (`connection_limit`, `pool_timeout`, `pool_max_lifetime`) to the datasource URL. Tune the behaviour with the following environment variables:

| Variable | Description | Default |
| --- | --- | --- |
| `PRISMA_CONNECT_MAX_RETRIES` | Connection attempts before failing | `5` |
| `PRISMA_RETRY_MIN_TIMEOUT_MS` / `PRISMA_RETRY_MAX_TIMEOUT_MS` | Backoff bounds for initial connect | `500` / `5000` |
| `PRISMA_OPERATION_MAX_RETRIES` | Query retries for transient errors | `2` |
| `PRISMA_POOL_MAX` | Maximum database connections | `10` |
| `PRISMA_POOL_TIMEOUT_MS` | Milliseconds to wait for a pooled connection | `5000` |
| `PRISMA_POOL_MAX_LIFETIME_MS` | Milliseconds before recycling pooled connections | `30000` |

These defaults are safe for development. Increase `PRISMA_POOL_MAX` when deploying behind PgBouncer or for production workloads.
