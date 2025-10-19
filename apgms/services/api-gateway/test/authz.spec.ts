import { createHmac } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";

const buildPrismaStub = () => ({
  user: {
    findMany: async () => [],
  },
  bankLine: {
    findMany: async () => [],
    create: async ({ data }: { data: Record<string, unknown> }) => ({
      id: "line-1",
      ...data,
    }),
  },
});

const signToken = (payload: Record<string, unknown>, secret: string) => {
  const encode = (segment: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(segment)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT" });
  const body = encode(payload);
  const signature = createHmac("sha256", secret)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
};

const setupApp = async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test-secret";
  process.env.CORS_ALLOW_ORIGINS = process.env.CORS_ALLOW_ORIGINS ?? "https://example.com";

  const { buildApp } = await import("../src/index.ts");
  const app = await buildApp({ logger: false, prismaClient: buildPrismaStub() });
  await app.ready();
  return app;
};

test("non-health routes require bearer token", async (t) => {
  const app = await setupApp();
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({ method: "GET", url: "/users" });
  assert.equal(response.statusCode, 401);
});

test("rejects invalid token", async (t) => {
  const app = await setupApp();
  t.after(async () => {
    await app.close();
  });

  const token = signToken({ sub: "user-1", orgId: "org-1" }, process.env.JWT_SECRET as string);
  const response = await app.inject({
    method: "GET",
    url: "/bank-lines",
    headers: { Authorization: `Bearer ${token}invalid` },
  });

  assert.equal(response.statusCode, 401);
});

test("prevents cross-org access on create", async (t) => {
  const app = await setupApp();
  t.after(async () => {
    await app.close();
  });

  const token = signToken({ sub: "user-1", orgId: "org-1" }, process.env.JWT_SECRET as string);
  const response = await app.inject({
    method: "POST",
    url: "/bank-lines",
    headers: { Authorization: `Bearer ${token}` },
    payload: {
      orgId: "org-2",
      date: new Date().toISOString(),
      amount: 100,
      payee: "Vendor",
      desc: "Mismatch org",
    },
  });

  assert.equal(response.statusCode, 403);
});

test("allows authorized create within org", async (t) => {
  const app = await setupApp();
  t.after(async () => {
    await app.close();
  });

  const token = signToken({ sub: "user-1", orgId: "org-1" }, process.env.JWT_SECRET as string);
  const response = await app.inject({
    method: "POST",
    url: "/bank-lines",
    headers: { Authorization: `Bearer ${token}` },
    payload: {
      orgId: "org-1",
      date: new Date().toISOString(),
      amount: 100,
      payee: "Vendor",
      desc: "ok",
    },
  });

  assert.equal(response.statusCode, 201);
});
