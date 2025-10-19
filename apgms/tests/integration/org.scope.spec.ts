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

const baseBankLines: BankLineRecord[] = [
  {
    id: "line-1",
    orgId: "org-1",
    date: new Date("2023-01-01T00:00:00.000Z"),
    amount: 100,
    payee: "Vendor A",
    desc: "Subscription",
    createdAt: new Date("2023-01-02T00:00:00.000Z"),
  },
  {
    id: "line-2",
    orgId: "org-2",
    date: new Date("2023-01-03T00:00:00.000Z"),
    amount: 200,
    payee: "Vendor B",
    desc: "Consulting",
    createdAt: new Date("2023-01-04T00:00:00.000Z"),
  },
];

const baseUsers = [
  { id: "user-1", email: "alpha@example.com", orgId: "org-1", createdAt: new Date("2023-01-05") },
  { id: "user-2", email: "beta@example.com", orgId: "org-2", createdAt: new Date("2023-01-06") },
];

function createPrisma(): PrismaAdapter {
  let bankLines = baseBankLines.map((line) => ({ ...line }));
  const users = baseUsers.map((user) => ({ ...user }));

  return {
    user: {
      findMany: async (args) => {
        const orgId = args?.where?.orgId ?? undefined;
        return users
          .filter((user) => !orgId || user.orgId === orgId)
          .map(({ email, orgId: userOrgId, createdAt }) => ({ email, orgId: userOrgId, createdAt }));
      },
    },
    bankLine: {
      findMany: async (args) => {
        const orgId = args?.where?.orgId ?? undefined;
        return bankLines
          .filter((line) => !orgId || line.orgId === orgId)
          .sort((a, b) => b.date.getTime() - a.date.getTime());
      },
      findFirst: async (args) => {
        const predicate = args?.where;
        if (!predicate) {
          return null;
        }
        return (
          bankLines.find((line) => {
            const sameOrg = !predicate.orgId || line.orgId === predicate.orgId;
            const sameDate =
              !predicate.date ||
              (predicate.date instanceof Date
                ? line.date.getTime() === predicate.date.getTime()
                : line.date.getTime() === new Date(predicate.date as Date).getTime());
            const sameAmount =
              !predicate.amount ||
              line.amount === Number((predicate.amount as unknown as { equals?: unknown })?.equals ?? predicate.amount);
            const samePayee = !predicate.payee || line.payee === predicate.payee;
            const sameDesc = !predicate.desc || line.desc === predicate.desc;
            return sameOrg && sameDate && sameAmount && samePayee && sameDesc;
          }) ?? null
        );
      },
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
  };
}

test("bank lines are scoped to the caller's org", async () => {
  const prisma = createPrisma();
  const app = await buildApp(prisma, { logger: false });

  const response = await app.inject({
    method: "GET",
    url: "/bank-lines",
    headers: { "x-org-id": "org-1", "x-user-id": "user-1" },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as { lines: BankLineRecord[] };
  assert.equal(payload.lines.length, 1);
  assert.equal(payload.lines[0].orgId, "org-1");

  await app.close();
});

test("user listings are scoped to the caller's org", async () => {
  const prisma = createPrisma();
  const app = await buildApp(prisma, { logger: false });

  const response = await app.inject({
    method: "GET",
    url: "/users",
    headers: { "x-org-id": "org-2", "x-user-id": "user-2" },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json() as { users: Array<{ orgId: string }> };
  assert.equal(payload.users.length, 1);
  assert.equal(payload.users[0].orgId, "org-2");

  await app.close();
});
