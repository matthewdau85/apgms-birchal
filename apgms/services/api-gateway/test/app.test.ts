import test from "node:test";
import assert from "node:assert/strict";

import { prisma } from "../src/deps.ts";

type UserRecord = { email: string; orgId: string; createdAt: Date };
type BankLineRecord = {
  id: string;
  orgId: string;
  date: Date;
  amount: number;
  payee: string;
  desc: string;
  createdAt: Date;
};

const userFindMany = test.mock.method(prisma.user, "findMany", async () => defaultUsers);
const bankLineFindMany = test.mock.method(prisma.bankLine, "findMany", async () => defaultLines);
const bankLineCreate = test.mock.method(
  prisma.bankLine,
  "create",
  async (input: { data: BankLineRecord }) => ({ ...input.data, id: "line-1" }),
);

let defaultUsers: UserRecord[] = [];
let defaultLines: BankLineRecord[] = [];

test.beforeEach(() => {
  defaultUsers = [{ email: "a@example.com", orgId: "org-1", createdAt: new Date("2024-01-01") }];
  defaultLines = [
    {
      id: "line-1",
      orgId: "org-1",
      date: new Date("2024-01-01"),
      amount: 100,
      payee: "Vendor",
      desc: "Payment",
      createdAt: new Date("2024-01-02"),
    },
  ];
  userFindMany.mock.resetCalls();
  bankLineFindMany.mock.resetCalls();
  bankLineCreate.mock.resetCalls();
  userFindMany.mock.mockImplementation(async () => defaultUsers);
  bankLineFindMany.mock.mockImplementation(async () => defaultLines);
  bankLineCreate.mock.mockImplementation(async ({ data }: { data: BankLineRecord }) => ({ ...data, id: "line-2" }));
});

test.after(() => {
  test.mock.restoreAll();
});

async function buildApp() {
  const { createApp } = (await import("../src/app.ts")) as typeof import("../src/app.ts");
  return createApp({ logger: false });
}

test("exposes health endpoint", async (t) => {
  const app = await buildApp();
  t.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/health" });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ok: true, service: "api-gateway" });
});

test("returns users ordered by createdAt", async (t) => {
  const app = await buildApp();
  t.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/users" });

  assert.equal(userFindMany.mock.callCount(), 1);
  assert.deepEqual(userFindMany.mock.calls[0].arguments[0], {
    select: { email: true, orgId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    users: defaultUsers.map((user) => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
    })),
  });
});

test("limits bank line listings and enforces bounds", async (t) => {
  const app = await buildApp();
  t.after(() => app.close());

  await app.inject({ method: "GET", url: "/bank-lines?take=500" });
  const firstCall = bankLineFindMany.mock.calls[0].arguments[0] as { take: number };
  assert.equal(firstCall.take, 200);

  await app.inject({ method: "GET", url: "/bank-lines?take=-5" });
  const secondCall = bankLineFindMany.mock.calls[1].arguments[0] as { take: number };
  assert.equal(secondCall.take, 1);

  const response = await app.inject({ method: "GET", url: "/bank-lines" });
  const thirdCall = bankLineFindMany.mock.calls[2].arguments[0] as { take: number };
  assert.equal(thirdCall.take, 20);
  const lines = (await bankLineFindMany.mock.calls[2].result) as BankLineRecord[];
  assert.deepEqual(response.json(), {
    lines: lines.map((line: BankLineRecord) => ({
      ...line,
      date: new Date(line.date).toISOString(),
      createdAt: new Date(line.createdAt).toISOString(),
    })),
  });
});

test("creates bank lines and returns the persisted record", async (t) => {
  const app = await buildApp();
  t.after(() => app.close());

  const payload = {
    orgId: "org-1",
    date: "2024-02-01",
    amount: 200,
    payee: "Supplier",
    desc: "Invoice",
  };

  const response = await app.inject({
    method: "POST",
    url: "/bank-lines",
    payload,
    headers: { "content-type": "application/json" },
  });

  assert.equal(bankLineCreate.mock.callCount(), 1);
  assert.deepEqual(bankLineCreate.mock.calls[0].arguments[0], {
    data: {
      orgId: "org-1",
      date: new Date("2024-02-01"),
      amount: 200,
      payee: "Supplier",
      desc: "Invoice",
    },
  });
  assert.equal(response.statusCode, 201);
  assert.equal(response.json().payee, "Supplier");
});

test("reports bad requests when persistence fails", async (t) => {
  bankLineCreate.mock.mockImplementationOnce(async () => {
    throw new Error("boom");
  });

  const app = await buildApp();
  t.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/bank-lines",
    payload: {
      orgId: "org-1",
      date: "2024-02-01",
      amount: 200,
      payee: "Supplier",
      desc: "Invoice",
    },
    headers: { "content-type": "application/json" },
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), { error: "bad_request" });
});

test("enables CORS for browser clients", async (t) => {
  const app = await buildApp();
  t.after(() => app.close());

  const response = await app.inject({
    method: "OPTIONS",
    url: "/bank-lines",
    headers: {
      origin: "https://example.com",
      "access-control-request-method": "POST",
    },
  });

  assert.equal(response.headers["access-control-allow-origin"], "https://example.com");
});
