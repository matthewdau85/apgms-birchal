import assert from "node:assert/strict";
import { test } from "node:test";
import Fastify from "fastify";
import healthRoutes from "../src/routes/health";

const prismaStub = {
  $queryRaw: async (..._args: unknown[]) => Promise.resolve(1),
  $disconnect: async () => Promise.resolve(),
};

test("readyz reflects database availability", { concurrency: false }, async (t) => {
  await t.test("returns 200 when the database is reachable", async () => {
    prismaStub.$queryRaw = async (..._args: unknown[]) => Promise.resolve(1);

    const app = Fastify();
    app.decorate("prisma", prismaStub);
    await app.register(healthRoutes);
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/readyz" });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { ready: true });

    await app.close();
  });

  await t.test("returns 503 when the database is unreachable", async () => {
    prismaStub.$queryRaw = async (..._args: unknown[]) => {
      throw new Error("db down");
    };

    const app = Fastify();
    app.decorate("prisma", prismaStub);
    await app.register(healthRoutes);
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/readyz" });
    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.json(), { ready: false, reason: "db_unreachable" });

    await app.close();
  });

  await t.test("healthz always responds with service status", async () => {
    prismaStub.$queryRaw = async (..._args: unknown[]) => Promise.resolve(1);

    const app = Fastify();
    app.decorate("prisma", prismaStub);
    await app.register(healthRoutes);
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/healthz" });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { ok: true, service: "api-gateway" });

    await app.close();
  });
});
