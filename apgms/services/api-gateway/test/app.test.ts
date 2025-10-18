import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { buildApp } from "../src/app";
import { PrismaLike } from "../src/services/types";

const secret = "test-secret";

const encodeSegment = (value: unknown) =>
  Buffer.from(JSON.stringify(value), "utf8").toString("base64url");

const createToken = async (claims: Record<string, unknown> = {}) => {
  const headerSegment = encodeSegment({ alg: "HS256", typ: "JWT" });
  const payload = {
    roles: ["users:read", "bank-lines:read", "bank-lines:write"],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300,
    sub: String(claims.sub ?? "user-1"),
    ...claims,
  };
  const payloadSegment = encodeSegment(payload);
  const signature = createHmac("sha256", secret).update(`${headerSegment}.${payloadSegment}`).digest("base64url");
  return `${headerSegment}.${payloadSegment}.${signature}`;
};

test.beforeEach(() => {
  process.env.JWT_SECRET = secret;
  process.env.LOG_LEVEL = "silent";
});

test("GET /health is public", async (t) => {
  const prismaMock: PrismaLike = {
    user: { findMany: async () => [] },
    bankLine: { findMany: async () => [], create: async () => ({}) },
  } as unknown as PrismaLike;

  const { app } = await buildApp({
    services: { prisma: prismaMock },
    connectors: { audit: { record: async () => {} } },
  });

  t.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/health" });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.ok, true);
  assert.equal(body.service, "api-gateway");
});

test("GET /users requires authentication", async (t) => {
  const prismaMock: PrismaLike = {
    user: { findMany: async () => [] },
    bankLine: { findMany: async () => [], create: async () => ({}) },
  } as unknown as PrismaLike;

  const { app } = await buildApp({
    services: { prisma: prismaMock },
    connectors: { audit: { record: async () => {} } },
  });

  t.after(() => app.close());

  const response = await app.inject({ method: "GET", url: "/users" });
  assert.equal(response.statusCode, 401);
  const body = response.json();
  assert.equal(body.error.code, "unauthorized");
});

test("GET /users returns sanitized data when authorized", async (t) => {
  const prismaMock: PrismaLike = {
    user: {
      findMany: async () => [
        { email: "founder@example.com", orgId: "org-1", createdAt: new Date("2024-01-01T00:00:00Z") },
      ],
    },
    bankLine: { findMany: async () => [], create: async () => ({}) },
  } as unknown as PrismaLike;

  const { app } = await buildApp({
    services: { prisma: prismaMock },
    connectors: { audit: { record: async () => {} } },
  });

  t.after(() => app.close());

  const token = await createToken({ roles: ["users:read"] });
  const response = await app.inject({
    method: "GET",
    url: "/users",
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.deepEqual(body, {
    users: [
      {
        email: "founder@example.com",
        orgId: "org-1",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    ],
  });
});

test("POST /bank-lines validates payload", async (t) => {
  const prismaMock: PrismaLike = {
    user: { findMany: async () => [] },
    bankLine: { findMany: async () => [], create: async () => ({}) },
  } as unknown as PrismaLike;

  const { app } = await buildApp({
    services: { prisma: prismaMock },
    connectors: { audit: { record: async () => {} } },
  });

  t.after(() => app.close());

  const token = await createToken();
  const response = await app.inject({
    method: "POST",
    url: "/bank-lines",
    headers: { Authorization: `Bearer ${token}` },
    payload: { invalid: true },
  });

  assert.equal(response.statusCode, 400);
  const body = response.json();
  assert.equal(body.error.code, "validation_error");
});

test("POST /bank-lines enforces roles", async (t) => {
  const prismaMock: PrismaLike = {
    user: { findMany: async () => [] },
    bankLine: { findMany: async () => [], create: async () => ({}) },
  } as unknown as PrismaLike;

  const { app } = await buildApp({
    services: { prisma: prismaMock },
    connectors: { audit: { record: async () => {} } },
  });

  t.after(() => app.close());

  const token = await createToken({ roles: ["bank-lines:read"] });
  const response = await app.inject({
    method: "POST",
    url: "/bank-lines",
    headers: { Authorization: `Bearer ${token}` },
    payload: {
      orgId: "org-1",
      date: new Date("2024-01-01").toISOString(),
      amount: 25,
      payee: "Vendor",
      desc: "Service",
    },
  });

  assert.equal(response.statusCode, 403);
  const body = response.json();
  assert.equal(body.error.code, "forbidden");
});

test("POST /bank-lines orchestrates audit workflow", async (t) => {
  const createdAt = new Date("2024-02-02T00:00:00Z");
  const date = new Date("2024-02-01T00:00:00Z");

  const prismaMock: PrismaLike = {
    user: { findMany: async () => [] },
    bankLine: {
      findMany: async () => [],
      create: async () => ({
        id: "line-1",
        orgId: "org-1",
        date,
        amount: 99.99,
        payee: "Acme",
        desc: "Subscription",
        createdAt,
      }),
    },
  } as unknown as PrismaLike;

  const auditCalls: unknown[] = [];
  const { app } = await buildApp({
    services: { prisma: prismaMock },
    connectors: {
      audit: {
        record: async (event) => {
          auditCalls.push(event);
        },
      },
    },
  });

  t.after(() => app.close());

  const token = await createToken();
  const response = await app.inject({
    method: "POST",
    url: "/bank-lines",
    headers: { Authorization: `Bearer ${token}` },
    payload: {
      orgId: "org-1",
      date: date.toISOString(),
      amount: 99.99,
      payee: "Acme",
      desc: "Subscription",
    },
  });

  assert.equal(response.statusCode, 201);
  const body = response.json();
  assert.deepEqual(body, {
    id: "line-1",
    orgId: "org-1",
    date: date.toISOString(),
    amount: 99.99,
    payee: "Acme",
    desc: "Subscription",
    createdAt: createdAt.toISOString(),
  });
  assert.equal(auditCalls.length, 1);
  assert.equal((auditCalls[0] as any).event, "bank_line.created");
});

test("POST /bank-lines surfaces workflow errors", async (t) => {
  const prismaMock: PrismaLike = {
    user: { findMany: async () => [] },
    bankLine: {
      findMany: async () => [],
      create: async () => ({
        id: "line-2",
        orgId: "org-1",
        date: new Date("2024-03-01T00:00:00Z"),
        amount: 50,
        payee: "Vendor",
        desc: "Service",
        createdAt: new Date("2024-03-02T00:00:00Z"),
      }),
    },
  } as unknown as PrismaLike;

  const { app } = await buildApp({
    services: { prisma: prismaMock },
    connectors: {
      audit: {
        record: async () => {
          throw new Error("audit down");
        },
      },
    },
  });

  t.after(() => app.close());

  const token = await createToken();
  const response = await app.inject({
    method: "POST",
    url: "/bank-lines",
    headers: { Authorization: `Bearer ${token}` },
    payload: {
      orgId: "org-1",
      date: new Date("2024-03-01T00:00:00Z").toISOString(),
      amount: 50,
      payee: "Vendor",
      desc: "Service",
    },
  });

  assert.equal(response.statusCode, 502);
  const body = response.json();
  assert.equal(body.error.code, "workflow_error");
});
