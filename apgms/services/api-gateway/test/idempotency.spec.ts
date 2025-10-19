import assert from "node:assert/strict";
import Fastify from "fastify";
import test from "node:test";
import idempotencyPlugin from "../src/plugins/idempotency";
import { redis } from "../src/redis";

test("rejects POST requests without an idempotency key", { concurrency: false }, async () => {
  await redis.flushall();
  const app = Fastify();
  await idempotencyPlugin(app);
  app.post("/resource", async () => ({ ok: true }));

  const response = await app.inject({ method: "POST", url: "/resource", payload: {} });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), { error: "missing_idempotency_key" });

  await app.close();
});

test("returns cached response on replay", { concurrency: false }, async () => {
  await redis.flushall();
  const app = Fastify();
  await idempotencyPlugin(app);
  app.post("/resource", async (request, reply) => {
    const counter = Number(request.headers["x-counter"] ?? 0);
    return reply.code(201).send({ ok: true, counter });
  });

  const headers = { "idempotency-key": "abc", "x-counter": "1" };
  const first = await app.inject({ method: "POST", url: "/resource", payload: {}, headers });
  assert.equal(first.statusCode, 201);
  assert.deepEqual(first.json(), { ok: true, counter: 1 });

  const second = await app.inject({ method: "POST", url: "/resource", payload: {}, headers });
  assert.equal(second.statusCode, 200);
  assert.equal(second.headers["x-idempotent-replay"], "1");
  assert.deepEqual(second.json(), { ok: true, counter: 1 });

  await app.close();
});
