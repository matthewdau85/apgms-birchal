import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { FullConfig } from "@playwright/test";

export default async function globalSetup(_config: FullConfig) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRoot = path.resolve(__dirname, "../..");

  const connectionUrl =
    process.env.E2E_DATABASE_URL ??
    process.env.TEST_DATABASE_URL ??
    "postgresql://apgms:apgms@127.0.0.1:5432/apgms_test?schema=public";

  process.env.DATABASE_URL = process.env.DATABASE_URL ?? connectionUrl;
  process.env.NODE_ENV = process.env.NODE_ENV ?? "test";

  execSync("pnpm prisma migrate deploy --schema shared/prisma/schema.prisma", {
    cwd: repoRoot,
    stdio: "inherit",
  });

  const { prisma } = await import("@apgms/shared");
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "BankLine", "User", "Org" RESTART IDENTITY CASCADE;');

  const { buildApp } = await import("../../services/api-gateway/src/app");
  const app = await buildApp({ skipLogging: true });
  const host = process.env.API_GATEWAY_HOST ?? "127.0.0.1";
  const port = Number(process.env.API_GATEWAY_PORT ?? 4010);
  await app.listen({ host, port });

  process.env.API_BASE_URL = `http://${host}:${port}`;

  return async () => {
    await app.close();
    await prisma.$disconnect();
  };
}
