# APGMS

Quickstart:
pnpm i
pnpm -r build
docker compose up -d
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"
pnpm dlx prisma db push --schema shared/prisma/schema.prisma
pnpm tsx scripts/seed.ts
pnpm -r test
pnpm -w exec playwright test
