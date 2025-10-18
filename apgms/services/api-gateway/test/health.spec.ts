import assert from "node:assert/strict";
import { test } from "node:test";

process.env.NODE_ENV = "test";

const { prisma } = await import("../../../shared/src/db");

test("GET /healthz reports service availability", async (t) => {
  process.env.NODE_ENV = "test";
  const { buildApp } = await import("../src/index.ts");
  const app = buildApp();
  await app.ready();

  const response = await app.inject({ method: "GET", url: "/healthz" });

  assert.equal(response.statusCode, 200);
  assert.deepStrictEqual(response.json(), { ok: true, service: "api-gateway" });

  await app.close();
});

test("GET /readyz returns ready when the database ping succeeds", async (t) => {
  process.env.NODE_ENV = "test";
  const { buildApp } = await import("../src/index.ts");
  const app = buildApp();
  await app.ready();

  const pingMock = t.mock.method(prisma, "$queryRaw", async () => []);

  const response = await app.inject({ method: "GET", url: "/readyz" });

  assert.equal(response.statusCode, 200);
  assert.deepStrictEqual(response.json(), { ready: true });
  assert.equal(pingMock.mock.callCount(), 1);

  await app.close();
  pingMock.mock.restore();
});

test("GET /readyz returns 503 when the database is unreachable", async (t) => {
  process.env.NODE_ENV = "test";
  const { buildApp } = await import("../src/index.ts");
  const app = buildApp();
  await app.ready();

  const error = new Error("connection lost");
  const pingMock = t.mock.method(prisma, "$queryRaw", async () => {
    throw error;
  });

  const response = await app.inject({ method: "GET", url: "/readyz" });

  assert.equal(response.statusCode, 503);
  assert.deepStrictEqual(response.json(), {
    ready: false,
    reason: "db_unreachable",
  });
  assert.equal(pingMock.mock.callCount(), 1);

  await app.close();
  pingMock.mock.restore();
});

test("shutdown handlers close Fastify and Prisma", async (t) => {
  process.env.NODE_ENV = "test";
  const module = await import("../src/index.ts");
  const { app, handleShutdownSignal, shutdown } = module;

  const closeMock = t.mock.method(app, "close", async () => {});
  const disconnectMock = t.mock.method(prisma, "$disconnect", async () => {});

  await handleShutdownSignal("SIGTERM");
  await shutdown();

  assert.equal(closeMock.mock.callCount(), 1);
  assert.equal(disconnectMock.mock.callCount(), 1);

  closeMock.mock.restore();
  disconnectMock.mock.restore();
});
