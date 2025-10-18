# Contributing

Thanks for spending time to improve the Birchal treasury platform! This guide walks through the conventions we follow across the monorepo.

## Getting started

1. Install [pnpm](https://pnpm.io/) and [Poetry](https://python-poetry.org/).
2. Run `pnpm install` from the repo root to link all TypeScript workspaces.
3. Use `pnpm --filter @apgms/api-gateway dev` (and similar filters) to boot individual services via `tsx`.
4. For the tax engine, `cd services/tax-engine` and run `poetry install && poetry run uvicorn app.main:app --reload`.

## Workflow

- Create feature branches off `main` and keep commits small and descriptive.
- Write tests or manual verification notes for significant behaviour changes.
- Lint your code before opening a PR: `pnpm lint` (todo) for TypeScript packages and `poetry run ruff check .` for Python.
- PR titles should follow `component: summary` (e.g. `api-gateway: enforce api keys`).
- Include screenshots when touching the web cockpit so reviewers can visualise the UX.

## Code style highlights

- Prefer TypeScript in the Node services and keep runtime guards with [Zod](https://github.com/colinhacks/zod).
- Use Fastify plugins/hooks for cross-cutting concerns such as auth or logging instead of scattering checks in handlers.
- The tax engine should expose Pydantic models with alias casing matching the API contract (camelCase outbound, snake_case internally).
- All new endpoints must document their request/response bodies in the PR description.

## Reporting security issues

If you discover a vulnerability, please email security@birchal.example with a detailed report. We'll acknowledge receipt within 48 hours and coordinate a fix timeline before public disclosure.
