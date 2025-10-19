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
  process.env.CORS_ALLOW_ORIGINS = "https://allowed.example.com";

  const { buildApp } = await import("../src/index.ts");
  const app = await buildApp({ logger: false, prismaClient: buildPrismaStub() });
  await app.ready();
  return app;
};

test("allows CORS preflight for allowed origin", async (t) => {
  const app = await setupApp();
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "OPTIONS",
    url: "/bank-lines",
    headers: {
      Origin: "https://allowed.example.com",
      "Access-Control-Request-Method": "POST",
    },
  });

  assert.equal(response.statusCode, 204);
  assert.equal(response.headers["access-control-allow-origin"], "https://allowed.example.com");
});

test("enforces rate limiting", async (t) => {
  process.env.NODE_ENV = "production";
  const app = await setupApp();
  t.after(async () => {
    await app.close();
    process.env.NODE_ENV = "test";
  });

  const token = signToken({ sub: "user-1", orgId: "org-1" }, process.env.JWT_SECRET as string);

  for (let i = 0; i < 60; i += 1) {
    const res = await app.inject({
      method: "GET",
      url: "/users",
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.statusCode, 200);
  }

  const limited = await app.inject({
    method: "GET",
    url: "/users",
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(limited.statusCode, 429);
});

test("rejects payloads over body limit", async (t) => {
  const app = await setupApp();
  t.after(async () => {
    await app.close();
  });

  const token = signToken({ sub: "user-1", orgId: "org-1" }, process.env.JWT_SECRET as string);
  const bigDescription = "x".repeat(600_000);
  const response = await app.inject({
    method: "POST",
    url: "/bank-lines",
    headers: { Authorization: `Bearer ${token}` },
    payload: {
      orgId: "org-1",
      date: new Date().toISOString(),
      amount: 10,
      payee: "Vendor",
      desc: bigDescription,
    },
  });

  assert.equal(response.statusCode, 413);
});
