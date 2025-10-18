# APGMS

## Prerequisites

- [pnpm](https://pnpm.io/) v9
- Node.js 18+
- Docker (required for Postgres/Redis)

## Setup

Install dependencies and generate Prisma client code:

```bash
pnpm install
pnpm --filter @apgms/shared prisma:generate
```

## Running the development stack

The `dev-up` scripts boot the entire stack:

```bash
./scripts/dev-up.sh
```

The script will:

1. Start Docker Compose services (Postgres and Redis).
2. Apply Prisma migrations and generate the client.
3. Seed demo data.
4. Launch the Fastify API and Vite dev server.
5. Open the web application in your browser.

Use the PowerShell alternative on Windows:

```powershell
pwsh scripts/dev-up.ps1
```

Pass `--no-browser` to either script to skip automatically opening the browser.

## Testing & linting

Run the workspace-wide commands:

```bash
pnpm lint
pnpm test
pnpm build
```

Each package (`shared`, `services/api-gateway`, `webapp`, `worker`) also exposes these scripts individually if you need to scope execution with `pnpm --filter`.
