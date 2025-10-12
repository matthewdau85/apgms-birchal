import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";
import supertest from "supertest";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { FastifyInstance } from "fastify";
import type { PrismaClient, BankLine, Org, Rule } from "@prisma/client";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "testcontainers";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "../../..");
const schemaPath = resolve(projectRoot, "shared/prisma/schema.prisma");

let container: StartedPostgreSqlContainer;
let prisma: PrismaClient;
let buildApp: () => Promise<FastifyInstance>;
let app: FastifyInstance | null = null;
let baseOrg: Org;
let baseRule: Rule;
let baseLines: BankLine[];

function getApp() {
  if (!app) {
    throw new Error("app not initialised");
  }
  return app;
}

async function runPrismaCommand(args: string[], env: NodeJS.ProcessEnv) {
  await execFileAsync("pnpm", ["exec", "prisma", ...args, `--schema=${schemaPath}`], {
    cwd: projectRoot,
    env,
    maxBuffer: 10 * 1024 * 1024,
  });
}

async function resetDatabase() {
  await prisma.idempotencyKey.deleteMany();
  await prisma.bankLine.deleteMany();
  await prisma.rule.deleteMany();
  await prisma.user.deleteMany();
  await prisma.org.deleteMany();
}

async function seedBaseData() {
  const orgId = `org-${randomUUID()}`;
  baseOrg = await prisma.org.create({
    data: { id: orgId, name: "Integration Org" },
  });

  baseRule = await prisma.rule.create({
    data: {
      orgId: baseOrg.id,
      matchPayeeContains: "coffee",
      category: "Meals",
      priority: 10,
    },
  });

  baseLines = await Promise.all([
    prisma.bankLine.create({
      data: {
        orgId: baseOrg.id,
        externalId: `${orgId}-seed-1`,
        date: new Date("2024-01-01T00:00:00.000Z"),
        amount: "100.50",
        payee: "Initial Vendor",
        desc: "Seed expense",
      },
    }),
    prisma.bankLine.create({
      data: {
        orgId: baseOrg.id,
        externalId: `${orgId}-seed-2`,
        date: new Date("2024-01-05T00:00:00.000Z"),
        amount: "250.75",
        payee: "Coffee Club",
        desc: "Weekly coffee",
        ruleId: baseRule.id,
        category: baseRule.category,
      },
    }),
  ]);
}

beforeAll(async () => {
  container = await new PostgreSqlContainer().start();
  const connectionUri = container.getConnectionUri();
  const shadowDbName = `${container.getDatabase()}_shadow`;

  const shadowUrl = new URL(connectionUri);
  shadowUrl.pathname = `/${shadowDbName}`;

  const username = container.getUsername();
  const password = container.getPassword();
  const database = container.getDatabase();

  const createShadowResult = await container.exec(
    [
      "psql",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      username,
      "-d",
      database,
      "-c",
      `SELECT 'CREATE DATABASE "${shadowDbName}"' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${shadowDbName}')\\gexec`,
    ],
    { env: { PGPASSWORD: password } } as any,
  );

  if (createShadowResult.exitCode !== 0) {
    throw new Error(`Failed to ensure shadow database: ${createShadowResult.output?.join("\n") ?? "unknown error"}`);
  }

  const env = {
    ...process.env,
    DATABASE_URL: connectionUri,
    SHADOW_DATABASE_URL: shadowUrl.toString(),
  } as NodeJS.ProcessEnv;

  await runPrismaCommand(["migrate", "deploy"], env);
  await runPrismaCommand(["db", "push"], env);

  process.env.DATABASE_URL = env.DATABASE_URL;
  process.env.SHADOW_DATABASE_URL = env.SHADOW_DATABASE_URL;

  ({ prisma } = await import("../../../shared/src/db.ts"));
  ({ buildApp } = await import("../src/app.ts"));
});

afterAll(async () => {
  if (app) {
    await app.close();
    app = null;
  }
  if (prisma) {
    await prisma.$disconnect();
  }
  if (container) {
    await container.stop();
  }
});

beforeEach(async () => {
  if (app) {
    await app.close();
    app = null;
  }
  await resetDatabase();
  await seedBaseData();
  app = await buildApp();
  await app.ready();
  await app.listen({ port: 0 });
});

afterEach(async () => {
  if (app) {
    await app.close();
    app = null;
  }
});

describe("bank lines integration", () => {
  test("create and list supports filters and paging", async () => {
    const createResponse = await supertest(getApp().server)
      .post("/bank-lines")
      .send({
        orgId: baseOrg.id,
        externalId: `ext-${randomUUID()}`,
        date: "2024-02-01T00:00:00.000Z",
        amount: 123.45,
        payee: "Acme Tools",
        desc: "Tools purchase",
      })
      .expect(201);

    expect(createResponse.body).toMatchObject({
      orgId: baseOrg.id,
      payee: "Acme Tools",
      externalId: expect.stringContaining("ext-"),
    });

    const listPageOne = await supertest(getApp().server)
      .get("/bank-lines")
      .query({ orgId: baseOrg.id, take: 1 })
      .expect(200);

    expect(listPageOne.body.total).toBeGreaterThanOrEqual(3);
    expect(listPageOne.body.lines).toHaveLength(1);
    const firstLine = listPageOne.body.lines[0];
    expect(firstLine.orgId).toBe(baseOrg.id);

    const filtered = await supertest(getApp().server)
      .get("/bank-lines")
      .query({ orgId: baseOrg.id, payee: "Acme" })
      .expect(200);

    expect(filtered.body.lines.every((line: any) => line.payee.includes("Acme"))).toBe(true);
  });

  test("duplicate externalId returns 409", async () => {
    const payload = {
      orgId: baseOrg.id,
      externalId: `${baseOrg.id}-duplicate`,
      date: "2024-03-01T00:00:00.000Z",
      amount: 45.67,
      payee: "Duplicate Vendor",
      desc: "Duplicate line",
    };

    await supertest(getApp().server).post("/bank-lines").send(payload).expect(201);

    const duplicateAttempt = await supertest(getApp().server)
      .post("/bank-lines")
      .send(payload)
      .expect(409);

    expect(duplicateAttempt.body).toEqual({ error: "duplicate_external_id" });
  });

  test("PATCH then DELETE bank line", async () => {
    const targetLine = baseLines[0];
    const patched = await supertest(getApp().server)
      .patch(`/bank-lines/${targetLine.id}`)
      .send({ amount: 999.99, payee: "Updated Vendor" })
      .expect(200);

    expect(patched.body.amount).toBeCloseTo(999.99, 2);
    expect(patched.body.payee).toBe("Updated Vendor");

    await supertest(getApp().server).delete(`/bank-lines/${targetLine.id}`).expect(204);

    const postDelete = await supertest(getApp().server)
      .get("/bank-lines")
      .query({ orgId: baseOrg.id, externalId: targetLine.externalId })
      .expect(200);

    expect(postDelete.body.lines).toHaveLength(0);
  });

  test("import summarises counters", async () => {
    const duplicateExternalId = baseLines[1].externalId;

    const response = await supertest(getApp().server)
      .post("/bank-lines/import")
      .send({
        orgId: baseOrg.id,
        lines: [
          {
            orgId: baseOrg.id,
            externalId: `${baseOrg.id}-import-1`,
            date: "2024-04-01T00:00:00.000Z",
            amount: 200,
            payee: "Fresh Supplier",
            desc: "New line",
          },
          {
            orgId: baseOrg.id,
            externalId: duplicateExternalId,
            date: baseLines[1].date.toISOString(),
            amount: baseLines[1].amount.toNumber(),
            payee: baseLines[1].payee,
            desc: baseLines[1].desc,
          },
          {
            orgId: baseOrg.id,
            externalId: baseLines[0].externalId,
            date: "2024-05-01T00:00:00.000Z",
            amount: 555.55,
            payee: "Initial Vendor",
            desc: "Updated line",
          },
        ],
      })
      .expect(200);

    expect(response.body).toMatchObject({
      created: 1,
      duplicates: 1,
      updated: 1,
      total: 3,
    });

    const updatedLine = await prisma.bankLine.findUnique({
      where: { externalId: baseLines[0].externalId },
    });
    expect(updatedLine?.amount.toString()).toBe("555.55");
  });

  test("rules apply to imported lines", async () => {
    const result = await supertest(getApp().server)
      .post("/bank-lines/import")
      .send({
        orgId: baseOrg.id,
        lines: [
          {
            orgId: baseOrg.id,
            externalId: `${baseOrg.id}-coffee-1`,
            date: "2024-06-01T00:00:00.000Z",
            amount: 15.25,
            payee: "Downtown Coffee Roasters",
            desc: "Flat white",
          },
        ],
      })
      .expect(200);

    expect(result.body.created).toBe(1);
    const [line] = result.body.lines;
    expect(line.category).toBe(baseRule.category);
    expect(line.rule?.id).toBe(baseRule.id);
  });

  test("idempotent imports reuse previous result", async () => {
    const key = `key-${randomUUID()}`;
    const payload = {
      orgId: baseOrg.id,
      lines: [
        {
          orgId: baseOrg.id,
          externalId: `${baseOrg.id}-once`,
          date: "2024-07-01T00:00:00.000Z",
          amount: 99.99,
          payee: "One Shot",
          desc: "Idempotent",
        },
      ],
    };

    const first = await supertest(getApp().server)
      .post("/bank-lines/import")
      .set("Idempotency-Key", key)
      .send(payload)
      .expect(200);

    expect(first.body.created).toBe(1);

    const second = await supertest(getApp().server)
      .post("/bank-lines/import")
      .set("Idempotency-Key", key)
      .send(payload)
      .expect(200);

    expect(second.body).toEqual(first.body);

    const lines = await prisma.bankLine.findMany({
      where: { externalId: payload.lines[0].externalId },
    });
    expect(lines).toHaveLength(1);
  });
});
