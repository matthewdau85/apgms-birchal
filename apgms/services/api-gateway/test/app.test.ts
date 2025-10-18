import { createHmac, randomUUID } from "node:crypto";
import assert from "node:assert";
import { afterEach, beforeEach, test } from "node:test";
import type { FastifyInstance } from "fastify";

process.env.API_SIGNING_SECRET = "test-signing";
process.env.NODE_ENV = "test";
process.env.API_KEYS = "test-key:org-1";
process.env.CORS_ORIGINS = "http://trusted.test";
process.env.WEBHOOK_SECRET = "webhook-secret";
process.env.RATE_LIMIT_MAX = "10000";

const API_SIGNATURE = createHmac("sha256", process.env.API_SIGNING_SECRET!)
  .update("test-key")
  .digest("hex");
const API_KEY_HEADER = `test-key.${API_SIGNATURE}`;

const FORBIDDEN_SIGNATURE = createHmac(
  "sha256",
  process.env.API_SIGNING_SECRET!
)
  .update("ghost")
  .digest("hex");
const FORBIDDEN_KEY = `ghost.${FORBIDDEN_SIGNATURE}`;

let app: FastifyInstance;

let users: Array<{ email: string; orgId: string; createdAt: Date }> = [];
let bankLines: Array<{
  id: string;
  orgId: string;
  date: Date;
  amount: number;
  payee: string;
  desc: string;
  createdAt: Date;
}> = [];

let shared: typeof import("../../../shared/src/db.js");
let originalUserFindMany: any;
let originalBankFindMany: any;
let originalBankCreate: any;

beforeEach(async () => {
  const module = await import("../src/app.js");
  const audit = await import("../src/audit.js");
  audit.resetAuditTrail();

  users = [
    {
      email: "user@example.com",
      orgId: "org-1",
      createdAt: new Date("2023-01-01T00:00:00.000Z"),
    },
  ];
  bankLines = [];

  shared = await import("../../../shared/src/db.js");

  originalUserFindMany = shared.prisma.user.findMany.bind(shared.prisma.user);
  originalBankFindMany = shared.prisma.bankLine.findMany.bind(
    shared.prisma.bankLine
  );
  originalBankCreate = shared.prisma.bankLine.create.bind(shared.prisma.bankLine);

  (shared.prisma.user.findMany as any) = async (args: any) => {
    const filtered = users.filter((user) => user.orgId === args.where.orgId);
    return filtered
      .map((user) => ({ ...user }))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  };

  (shared.prisma.bankLine.findMany as any) = async (args: any) => {
    return bankLines
      .filter((line) => line.orgId === args.where.orgId)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, args.take ?? bankLines.length)
      .map((line) => ({ ...line }));
  };

  (shared.prisma.bankLine.create as any) = async (args: any) => {
    const now = new Date();
    const created = {
      id: randomUUID(),
      orgId: args.data.orgId,
      date: new Date(args.data.date),
      amount: Number(args.data.amount),
      payee: args.data.payee,
      desc: args.data.desc,
      createdAt: now,
    };
    bankLines.push(created);
    return { ...created };
  };

  app = await module.createApp();
});

afterEach(async () => {
  if (app) {
    await app.close();
  }
  if (shared) {
    (shared.prisma.user.findMany as any) = originalUserFindMany;
    (shared.prisma.bankLine.findMany as any) = originalBankFindMany;
    (shared.prisma.bankLine.create as any) = originalBankCreate;
  }
});

test("health is publicly accessible", async () => {
  const response = await app.inject({ method: "GET", url: "/health" });
  assert.strictEqual(response.statusCode, 200);
  const body = response.json();
  assert.strictEqual(body.ok, true);
});

test("rejects missing API key", async () => {
  const response = await app.inject({ method: "GET", url: "/users" });
  assert.strictEqual(response.statusCode, 401);
});

test("rejects unknown API key", async () => {
  const badSignature = createHmac("sha256", "other").update("missing").digest("hex");
  const response = await app.inject({
    method: "GET",
    url: "/users",
    headers: { "x-api-key": `missing.${badSignature}` },
  });
  assert.strictEqual(response.statusCode, 401);
});

test("rejects forbidden API key", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/users",
    headers: { "x-api-key": FORBIDDEN_KEY },
  });
  assert.strictEqual(response.statusCode, 403);
});

test("lists users for authenticated org", async () => {
  const response = await app.inject({
    method: "GET",
    url: "/users",
    headers: { "x-api-key": API_KEY_HEADER },
  });
  assert.strictEqual(response.statusCode, 200);
  const body = response.json();
  assert.strictEqual(body.data.users.length, 1);
  assert.strictEqual(body.data.users[0].orgId, "org-1");
});

test("creates bank line with idempotency", async () => {
  const payload = {
    date: "2024-01-01",
    amount: 100,
    payee: "Vendor",
    desc: "Invoice",
  };

  const headers = {
    "x-api-key": API_KEY_HEADER,
    "idempotency-key": randomUUID(),
  };

  const first = await app.inject({
    method: "POST",
    url: "/bank-lines",
    headers,
    payload,
  });
  assert.strictEqual(first.statusCode, 201);
  const firstBody = first.json();
  assert.strictEqual(bankLines.length, 1);

  const second = await app.inject({
    method: "POST",
    url: "/bank-lines",
    headers,
    payload,
  });
  assert.strictEqual(second.statusCode, 201);
  const secondBody = second.json();
  assert.deepStrictEqual(secondBody, firstBody);
  assert.strictEqual(bankLines.length, 1);
});

test("flags idempotency conflicts", async () => {
  const headers = {
    "x-api-key": API_KEY_HEADER,
    "idempotency-key": randomUUID(),
  };

  const payloadA = {
    date: "2024-01-01",
    amount: 100,
    payee: "Vendor",
    desc: "Invoice",
  };
  const payloadB = { ...payloadA, amount: 200 };

  const first = await app.inject({
    method: "POST",
    url: "/bank-lines",
    headers,
    payload: payloadA,
  });
  assert.strictEqual(first.statusCode, 201);

  const second = await app.inject({
    method: "POST",
    url: "/bank-lines",
    headers,
    payload: payloadB,
  });
  assert.strictEqual(second.statusCode, 409);
});

test("webhook validates signatures and audit trail", async () => {
  const nonce = randomUUID();
  const timestamp = Date.now();
  const payload = {
    id: randomUUID(),
    type: "bank.update",
    occurredAt: new Date().toISOString(),
    data: { hello: "world" },
  };
  const canonical = JSON.stringify(payload);
  const signature = createHmac("sha256", process.env.WEBHOOK_SECRET!)
    .update(`${nonce}:${timestamp}:${canonical}`)
    .digest("hex");

  const response = await app.inject({
    method: "POST",
    url: "/webhooks/intake",
    headers: {
      "x-api-key": API_KEY_HEADER,
      "idempotency-key": randomUUID(),
      "x-webhook-nonce": nonce,
      "x-webhook-timestamp": String(timestamp),
      "x-webhook-signature": signature,
    },
    payload,
  });

  assert.strictEqual(response.statusCode, 202);
  const body = response.json();
  assert.strictEqual(body.data.received, true);

  const auditResponse = await app.inject({
    method: "GET",
    url: `/audit/rpt/${payload.id}`,
    headers: { "x-api-key": API_KEY_HEADER },
  });

  assert.strictEqual(auditResponse.statusCode, 200);
  const auditBody = auditResponse.json();
  assert.strictEqual(auditBody.data.valid, true);
});

test("rejects webhook replays", async () => {
  const nonce = randomUUID();
  const timestamp = Date.now();
  const payload = {
    id: randomUUID(),
    type: "bank.update",
    occurredAt: new Date().toISOString(),
    data: { hello: "world" },
  };
  const canonical = JSON.stringify(payload);
  const signature = createHmac("sha256", process.env.WEBHOOK_SECRET!)
    .update(`${nonce}:${timestamp}:${canonical}`)
    .digest("hex");

  const headers = {
    "x-api-key": API_KEY_HEADER,
    "idempotency-key": randomUUID(),
    "x-webhook-nonce": nonce,
    "x-webhook-timestamp": String(timestamp),
    "x-webhook-signature": signature,
  };

  const first = await app.inject({
    method: "POST",
    url: "/webhooks/intake",
    headers,
    payload,
  });
  assert.strictEqual(first.statusCode, 202);

  const replay = await app.inject({
    method: "POST",
    url: "/webhooks/intake",
    headers: { ...headers, "idempotency-key": randomUUID() },
    payload,
  });
  assert.strictEqual(replay.statusCode, 409);
});

test("detects tampered audit chain", async () => {
  const nonce = randomUUID();
  const timestamp = Date.now();
  const payload = {
    id: randomUUID(),
    type: "bank.update",
    occurredAt: new Date().toISOString(),
    data: { hello: "world" },
  };
  const canonical = JSON.stringify(payload);
  const signature = createHmac("sha256", process.env.WEBHOOK_SECRET!)
    .update(`${nonce}:${timestamp}:${canonical}`)
    .digest("hex");

  await app.inject({
    method: "POST",
    url: "/webhooks/intake",
    headers: {
      "x-api-key": API_KEY_HEADER,
      "idempotency-key": randomUUID(),
      "x-webhook-nonce": nonce,
      "x-webhook-timestamp": String(timestamp),
      "x-webhook-signature": signature,
    },
    payload,
  });

  const audit = await import("../src/audit.js");
  const entry = audit.getAuditEntry(payload.id);
  assert(entry);
  if (entry) {
    entry.hash = "bad-hash";
  }

  const auditResponse = await app.inject({
    method: "GET",
    url: `/audit/rpt/${payload.id}`,
    headers: { "x-api-key": API_KEY_HEADER },
  });

  assert.strictEqual(auditResponse.statusCode, 200);
  const auditBody = auditResponse.json();
  assert.strictEqual(auditBody.data.valid, false);
});

test("webhook rejects stale timestamps", async () => {
  const nonce = randomUUID();
  const timestamp = Date.now() - 10 * 60 * 1000;
  const payload = {
    id: randomUUID(),
    type: "bank.update",
    occurredAt: new Date().toISOString(),
    data: { hello: "world" },
  };
  const canonical = JSON.stringify(payload);
  const signature = createHmac("sha256", process.env.WEBHOOK_SECRET!)
    .update(`${nonce}:${timestamp}:${canonical}`)
    .digest("hex");

  const response = await app.inject({
    method: "POST",
    url: "/webhooks/intake",
    headers: {
      "x-api-key": API_KEY_HEADER,
      "idempotency-key": randomUUID(),
      "x-webhook-nonce": nonce,
      "x-webhook-timestamp": String(timestamp),
      "x-webhook-signature": signature,
    },
    payload,
  });

  assert.strictEqual(response.statusCode, 400);
});
