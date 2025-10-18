import assert from "node:assert/strict";
import { test } from "node:test";
import Fastify from "fastify";

import healthRoutes, { type PrismaClientLike } from "../src/routes/health";

const createApp = async (prisma: PrismaClientLike) => {
  const app = Fastify({ logger: false });
  await app.register(healthRoutes, { prisma });
  return app;
};

test("GET /healthz and /readyz succeed when database is reachable", async (t) => {
  const prismaMock: PrismaClientLike = {
    async $queryRaw() {
      return 1;
    },
  };

  const app = await createApp(prismaMock);
  t.after(async () => {
    await app.close();
  });

  const healthResponse = await app.inject({ method: "GET", url: "/healthz" });
  assert.equal(healthResponse.statusCode, 200);
  assert.deepEqual(healthResponse.json(), { ok: true, service: "api-gateway" });

  const readyResponse = await app.inject({ method: "GET", url: "/readyz" });
  assert.equal(readyResponse.statusCode, 200);
  assert.deepEqual(readyResponse.json(), { ready: true });
});

test("GET /readyz returns 503 when database is unreachable", async (t) => {
  const prismaMock: PrismaClientLike = {
    async $queryRaw() {
      throw new Error("db down");
    },
  };

  const app = await createApp(prismaMock);
  t.after(async () => {
    await app.close();
  });

  const readyResponse = await app.inject({ method: "GET", url: "/readyz" });
  assert.equal(readyResponse.statusCode, 503);
  assert.deepEqual(readyResponse.json(), { ready: false, reason: "db_unreachable" });
});

test("server can start and stop cleanly without open handles", async () => {
  const prismaMock: PrismaClientLike = {
    async $queryRaw() {
      return 1;
    },
  };

  const app = await createApp(prismaMock);

  try {
    await app.listen({ port: 0, host: "127.0.0.1" });
  } finally {
    await app.close();
  }

  assert.equal(app.server.listening, false);
});
