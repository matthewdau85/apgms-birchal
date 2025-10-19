import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../services/api-gateway/src/app.ts";
import type { PrismaAdapter } from "../../services/api-gateway/src/app.ts";

const setupModule = await import("../../scripts/test-setup.ts");
const setupFn =
  typeof setupModule.default === "function"
    ? setupModule.default
    : setupModule.default.default;

await setupFn();

interface BankLineRecord {
  id: string;
  orgId: string;
  date: Date;
  amount: number;
  payee: string;
  desc: string;
  createdAt: Date;
}

test("posting the same bank line twice is idempotent", async () => {
  let bankLines: BankLineRecord[] = [];

  const prisma = {
    user: { findMany: async () => [] },
    bankLine: {
      findMany: async () => bankLines,
      findFirst: async ({ where }) =>
        bankLines.find(
          (line) =>
            line.orgId === where?.orgId &&
            line.date.getTime() === (where?.date as Date).getTime() &&
            line.amount === Number(where?.amount) &&
            line.payee === where?.payee &&
            line.desc === where?.desc
        ) ?? null,
      create: async ({ data }) => {
        const created: BankLineRecord = {
          id: `line-${bankLines.length + 1}`,
          orgId: data.orgId as string,
          date: data.date as Date,
          amount: Number(data.amount),
          payee: data.payee as string,
          desc: data.desc as string,
          createdAt: new Date(),
        };
        bankLines = [...bankLines, created];
        return created;
      },
    },
  } as unknown as PrismaAdapter;

  const app = await buildApp(prisma, { logger: false });

  const payload = {
    date: "2024-01-01T00:00:00.000Z",
    amount: 100,
    payee: "Vendor",
    desc: "Retainer",
  };

  const first = await app.inject({
    method: "POST",
    url: "/bank-lines",
    headers: { "x-org-id": "org-123", "x-user-id": "user-123" },
    payload,
  });

  assert.equal(first.statusCode, 201);
  const created = first.json() as BankLineRecord;
  assert.ok(created.id);
  assert.equal(bankLines.length, 1);

  const second = await app.inject({
    method: "POST",
    url: "/bank-lines",
    headers: { "x-org-id": "org-123", "x-user-id": "user-123" },
    payload,
  });

  assert.equal(second.statusCode, 200);
  const reused = second.json() as BankLineRecord;
  assert.equal(reused.id, created.id);
  assert.equal(bankLines.length, 1);

  await app.close();
});
