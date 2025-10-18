import assert from "node:assert/strict";
import { describe, it } from "node:test";
import Fastify, { type FastifyInstance } from "fastify";
import idempotencyPlugin from "../src/plugins/idempotency";

async function buildTestApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(idempotencyPlugin, {
    paths: ["/bank-lines", "/allocations/apply"],
    redisUrl: process.env.REDIS_URL,
  });

  app.post("/bank-lines", async (req, rep) => {
    const body = req.body as Record<string, unknown>;
    return rep.code(201).send({
      id: "bank-line-1",
      ...body,
    });
  });

  app.post("/allocations/apply", async (req) => {
    const body = req.body as Record<string, unknown>;
    return { applied: true, ...body };
  });

  await app.ready();
  return app;
}

describe("idempotency middleware", () => {
  it("requires an Idempotency-Key header", async () => {
    process.env.REDIS_URL = "redis://mock";
    const app = await buildTestApp();

    try {
      const response = await app.inject({
        method: "POST",
        url: "/bank-lines",
        payload: { orgId: "org1" },
      });

      assert.equal(response.statusCode, 400);
      assert.deepEqual(response.json(), { error: "idempotency_key_required" });
    } finally {
      await app.close();
    }
  });

  it("caches POST /bank-lines responses", async () => {
    process.env.REDIS_URL = "redis://mock";
    const app = await buildTestApp();

    try {
      const payload = {
        orgId: "org1",
        date: "2024-01-01",
        amount: 100,
        payee: "Vendor",
        desc: "Invoice",
      };

      const first = await app.inject({
        method: "POST",
        url: "/bank-lines",
        headers: { "idempotency-key": "line-1" },
        payload,
      });

      assert.equal(first.statusCode, 201);
      const firstBody = first.json();

      const second = await app.inject({
        method: "POST",
        url: "/bank-lines",
        headers: { "idempotency-key": "line-1" },
        payload,
      });

      assert.equal(second.statusCode, 200);
      assert.equal(second.headers["idempotency-replay"], "true");
      assert.equal(second.headers["idempotency-original-status"], "201");
      assert.deepEqual(second.json(), firstBody);
    } finally {
      await app.close();
    }
  });

  it("rejects conflicting payloads for the same key", async () => {
    process.env.REDIS_URL = "redis://mock";
    const app = await buildTestApp();

    try {
      const payload = { orgId: "org1", amount: 100 };

      const first = await app.inject({
        method: "POST",
        url: "/bank-lines",
        headers: { "idempotency-key": "conflict" },
        payload,
      });

      assert.equal(first.statusCode, 201);

      const conflict = await app.inject({
        method: "POST",
        url: "/bank-lines",
        headers: { "idempotency-key": "conflict" },
        payload: { orgId: "org1", amount: 200 },
      });

      assert.equal(conflict.statusCode, 409);
      assert.deepEqual(conflict.json(), { error: "idempotency_key_conflict" });
    } finally {
      await app.close();
    }
  });

  it("caches allocations apply requests", async () => {
    process.env.REDIS_URL = "redis://mock";
    const app = await buildTestApp();

    try {
      const payload = { orgId: "org1", allocationId: "alloc-1" };

      const first = await app.inject({
        method: "POST",
        url: "/allocations/apply",
        headers: { "idempotency-key": "alloc-key" },
        payload,
      });

      assert.equal(first.statusCode, 200);

      const replay = await app.inject({
        method: "POST",
        url: "/allocations/apply",
        headers: { "idempotency-key": "alloc-key" },
        payload,
      });

      assert.equal(replay.statusCode, 200);
      assert.equal(replay.headers["idempotency-replay"], "true");
      assert.equal(replay.headers["idempotency-original-status"], "200");
      assert.deepEqual(replay.json(), first.json());
    } finally {
      await app.close();
    }
  });
});
