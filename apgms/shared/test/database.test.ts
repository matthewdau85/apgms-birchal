import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { BASELINE_DATA, getDatasourceUrl } from "../src/index.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const prismaDir = path.resolve(__dirname, "../prisma");

function readLatestMigrationSql(): string {
  const migrationsDir = path.join(prismaDir, "migrations");
  const entries = readdirSync(migrationsDir).filter((entry) =>
    statSync(path.join(migrationsDir, entry)).isDirectory(),
  );
  if (!entries.length) {
    throw new Error("No migrations found. Run `pnpm db:migrate:dev`.");
  }
  const latest = entries.sort().at(-1)!;
  return readFileSync(path.join(migrationsDir, latest, "migration.sql"), "utf8");
}

test("migrations include tables for every model", () => {
  const schemaPath = path.join(prismaDir, "schema.prisma");
  const schema = readFileSync(schemaPath, "utf8");
  const migrationSql = readLatestMigrationSql();

  const modelRegex = /model\s+(\w+)\s+{/g;
  const models: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = modelRegex.exec(schema))) {
    models.push(match[1]);
  }
  assert.ok(models.length > 0, "Expected at least one model in schema.prisma");
  for (const model of models) {
    const regex = new RegExp(`CREATE TABLE "${model}"`, "i");
    assert.match(migrationSql, regex, `Migration should contain table for ${model}`);
  }
});

test("migration SQL captures indexes and cascades", () => {
  const migrationSql = readLatestMigrationSql();
  assert.ok(
    migrationSql.includes("CREATE UNIQUE INDEX \"User_email_key\""),
    "User email unique index missing",
  );
  assert.ok(migrationSql.includes("ON DELETE CASCADE"), "Cascade behaviour missing");
});

test("datasource URL adds pooling parameters when configured", () => {
  const url = getDatasourceUrl();
  if (!process.env.DATABASE_URL) {
    assert.equal(url, undefined);
    return;
  }
  assert.ok(url?.includes("connection_limit="), "connection_limit missing");
  assert.ok(url?.includes("pool_timeout="), "pool_timeout missing");
});

test("baseline data relationships are consistent", () => {
  const orgIds = new Set(BASELINE_DATA.orgs.map((org) => org.id));
  assert.equal(orgIds.size, BASELINE_DATA.orgs.length, "Org IDs must be unique");

  const userEmails = new Set(BASELINE_DATA.users.map((user) => user.email));
  assert.equal(userEmails.size, BASELINE_DATA.users.length, "User emails must be unique");

  for (const user of BASELINE_DATA.users) {
    assert.ok(orgIds.has(user.orgId), `User ${user.email} references missing org ${user.orgId}`);
  }

  for (const line of BASELINE_DATA.bankLines) {
    assert.ok(orgIds.has(line.orgId), `Bank line ${line.id} references missing org ${line.orgId}`);
  }

  const amounts = BASELINE_DATA.bankLines.map((line) => Number(line.amount));
  assert.ok(amounts.some((value) => value > 0), "Expected at least one credit example");
  assert.ok(amounts.some((value) => value < 0), "Expected at least one debit example");
});
