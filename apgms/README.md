# APGMS

## Setup

1. Copy the root environment template and create service-specific `.env` files:
   ```bash
   cp .env.example .env
   for service in services/*; do cp "$service/.env.example" "$service/.env"; done
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Apply the initial database schema:
   ```bash
   pnpm --filter @apgms/shared prisma migrate deploy --schema=packages/shared/prisma/schema.prisma
   ```
4. Seed demo data (orgs, users, bank lines):
   ```bash
   pnpm --filter @apgms/shared prisma:seed
   ```

## Quickstart

```bash
pnpm -r build
docker compose up -d
pnpm -r test
pnpm -w exec playwright test
```
