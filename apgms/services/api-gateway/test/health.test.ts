import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import type { PrismaClient } from "@prisma/client";
import request from "supertest";
import { createApp } from "../src/app";

interface BankLineRecord {
  id: string;
  orgId: string;
  date: Date;
  amount: string;
  payee: string;
  desc: string;
  createdAt: Date;
}

const bankLines: BankLineRecord[] = [];

const prismaMock = {
  bankLine: {
    async create({ data }: { data: Record<string, any> }) {
      const record: BankLineRecord = {
        id: randomUUID(),
        orgId: data.orgId,
        date: new Date(data.date),
        amount: String(data.amount),
        payee: data.payee,
        desc: data.desc,
        createdAt: new Date(),
      };
      bankLines.push(record);
      bankLines.sort((a, b) => b.date.getTime() - a.date.getTime());
      return record;
    },
    async findMany({ take }: { take?: number }) {
      const limit = typeof take === "number" ? take : bankLines.length;
      return bankLines.slice(0, limit);
    },
  },
  user: {
    async findMany() {
      return [];
    },
  },
} as unknown as Pick<PrismaClient, "bankLine" | "user">;

let app: Awaited<ReturnType<typeof createApp>>;

before(async () => {
  app = await createApp({
    prismaClient: prismaMock,
    fastifyOptions: { logger: false },
  });
  await app.ready();
});

after(async () => {
  await app.close();
});

beforeEach(() => {
  bankLines.length = 0;
});

test("health ok", async () => {
  const res = await request(app).get("/health");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { ok: true, service: "api-gateway" });
});

test("bank lines create and read", async () => {
  const payload = {
    orgId: "org-123",
    date: new Date("2024-01-01T00:00:00.000Z").toISOString(),
    amount: 123.45,
    payee: "Test Payee",
    desc: "Test Description",
  };

  const createRes = await request(app).post("/bank-lines").send(payload);
  assert.equal(createRes.status, 201);
  assert.equal(typeof createRes.body.id, "string");
  assert.equal(new Date(createRes.body.date).toISOString(), payload.date);
  assert.deepEqual(createRes.body, {
    id: createRes.body.id,
    orgId: payload.orgId,
    date: payload.date,
    amount: String(payload.amount),
    payee: payload.payee,
    desc: payload.desc,
    createdAt: createRes.body.createdAt,
  });

  const listRes = await request(app).get("/bank-lines");
  assert.equal(listRes.status, 200);
  assert.equal(Array.isArray(listRes.body.lines), true);
  assert.equal(listRes.body.lines.length, 1);
  assert.deepEqual(listRes.body.lines[0], {
    id: createRes.body.id,
    orgId: payload.orgId,
    date: payload.date,
    amount: String(payload.amount),
    payee: payload.payee,
    desc: payload.desc,
    createdAt: listRes.body.lines[0].createdAt,
  });
});
