import { afterAll, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

const defaultDatabaseUrl =
  process.env.TEST_DATABASE_URL ?? "postgresql://apgms:apgms@127.0.0.1:5432/apgms_test?schema=public";

let migrated = false;

async function ensureMigrations() {
  if (migrated) return;
  execSync("pnpm prisma migrate deploy --schema shared/prisma/schema.prisma", {
    cwd: repoRoot,
    stdio: "inherit",
  });
  migrated = true;
}

beforeAll(async () => {
  process.env.NODE_ENV = process.env.NODE_ENV ?? "test";
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? defaultDatabaseUrl;

  await ensureMigrations();

  const { prisma } = await import("@apgms/shared");
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "BankLine", "User", "Org" RESTART IDENTITY CASCADE;');
});

afterAll(async () => {
  const { prisma } = await import("@apgms/shared");
  await prisma.$disconnect();
});
