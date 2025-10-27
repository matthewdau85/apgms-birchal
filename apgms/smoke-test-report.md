# Smoke Test Execution Report

## Setup Commands
- `pnpm i`
- `cp infra/dev/.env.example .env`
- `docker compose up -d`
- `pnpm -F @apgms/shared build`
- `pnpm run db:migrate`
- `pnpm run db:seed`

## Dev Server Commands
- `pnpm -F @apgms/api-gateway dev`
- `pnpm -F @apgms/webapp dev`
- `pnpm -F @apgms/worker dev`

## Smoke Checks
- `Invoke-WebRequest http://127.0.0.1:3000/health | Select StatusCode`
- `Invoke-WebRequest http://127.0.0.1:3000/users | Select StatusCode, Content`
- Browser check `http://localhost:5173/`

## Outcomes
1. `pnpm i` succeeded across all workspaces.
2. `.env` file could not be created because `infra/dev/.env.example` is missing from the repository.
3. Docker is unavailable in the execution environment, preventing the container stack from starting.
4. Shared package build succeeded via `pnpm -F @apgms/shared build`.
5. Database migration and seed scripts are not defined in the workspace `package.json` files, so `pnpm run db:migrate` and `pnpm run db:seed` are unavailable.
6. API gateway dev server failed to start because `@prisma/client` does not expose `PrismaClient` as a named export under ESM in the current install.
7. Webapp and worker packages do not define `dev` scripts, so their dev commands cannot be executed.
8. Smoke checks were skipped because the API server did not start and no web dev server is available.

