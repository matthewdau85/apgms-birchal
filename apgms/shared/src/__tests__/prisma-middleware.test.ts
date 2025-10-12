import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";

const defaultDbUrl = "postgresql://apgms:apgms@localhost:5432/apgms?schema=prisma_middleware_test";
const dbUrl = process.env.TEST_DATABASE_URL ?? defaultDbUrl;
const shadowUrl = process.env.TEST_SHADOW_DATABASE_URL ?? `${dbUrl}_shadow`;

process.env.DATABASE_URL = dbUrl;
process.env.SHADOW_DATABASE_URL = shadowUrl;

const { prisma, withOrgContext } = await import("../db");

const schemaName = (() => {
  const url = new URL(dbUrl);
  const schemaParam = url.searchParams.get("schema");
  return schemaParam ?? "public";
})();

const migrationsDir = path.resolve(fileURLToPath(new URL("../..", import.meta.url)), "prisma", "migrations");

const applyMigration = async (fileName: string) => {
  const filePath = path.join(migrationsDir, fileName, "migration.sql");
  const sql = await readFile(filePath, "utf8");
  const statements = sql
    .split(/;\s*\n/)
    .map((stmt) => stmt.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
};

before(async () => {
  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  await prisma.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);
  await applyMigration("20251010133921_init");
  await applyMigration("20251010140000_rls_guard");
});

after(async () => {
  await prisma.$disconnect();
});

describe("Prisma RLS middleware", () => {
  it("rejects access when org context is missing", async () => {
    await assert.rejects(prisma.user.findMany(), /apgms\.org_id/);
  });

  it("allows access when context is provided", async () => {
    const org = await prisma.org.create({ data: { name: `Org-${randomUUID()}` } });

    await withOrgContext(org.id, () =>
      prisma.user.create({
        data: {
          email: `${randomUUID()}@example.com`,
          password: "password123",
          orgId: org.id,
        },
      })
    );

    const users = await withOrgContext(org.id, () => prisma.user.findMany());
    assert.equal(users.length, 1);
    assert.equal(users[0]?.orgId, org.id);
  });

  it("isolates data between organisations", async () => {
    const primaryOrg = await prisma.org.create({ data: { name: `Org-${randomUUID()}` } });
    const otherOrg = await prisma.org.create({ data: { name: `Org-${randomUUID()}` } });

    await withOrgContext(primaryOrg.id, () =>
      prisma.bankLine.create({
        data: {
          orgId: primaryOrg.id,
          amount: 100,
          date: new Date(),
          payee: "Vendor",
          desc: "Subscription",
        },
      })
    );

    const visibleToPrimary = await withOrgContext(primaryOrg.id, () => prisma.bankLine.findMany());
    assert.equal(visibleToPrimary.length, 1);

    const visibleToOther = await withOrgContext(otherOrg.id, () => prisma.bankLine.findMany());
    assert.equal(visibleToOther.length, 0);
  });
});
