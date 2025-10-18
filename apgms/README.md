# APGMS

Quickstart:
pnpm i
pnpm db:generate
pnpm db:migrate:dev
pnpm db:seed
pnpm -r build
docker compose up -d
pnpm -r test
pnpm -w exec playwright test

Database operations are documented in [docs/ops/database.md](docs/ops/database.md).
