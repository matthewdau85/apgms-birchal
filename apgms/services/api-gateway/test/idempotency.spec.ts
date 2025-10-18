import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import Fastify, { type FastifyInstance } from "fastify";

import idempotencyPlugin from "../src/plugins/idempotency";
import InMemoryRedis from "../src/lib/in-memory-redis";

let app: FastifyInstance;
let redis: InMemoryRedis;

before(async () => {
  redis = new InMemoryRedis();
  app = Fastify();

  await idempotencyPlugin(app, { redis, ttlSeconds: 3600 });

  app.post(
    "/bank-lines",
    { config: { idempotency: true } },
    async (req, rep) => {
      const body = req.body as { value: string };
      const response = { value: body.value, createdAt: new Date().toISOString() };
      rep.header("etag", `W/"${response.value}"`);
      return rep.code(201).send(response);
    },
  );

  await app.ready();
});

after(async () => {
  await app.close();
  await redis.quit();
});

test("replays with matching payload reuse cached response", async () => {
  await redis.flushall();

  const key = "abc123";
  const payload = { value: "same" };

  const first = await app.inject({
    method: "POST",
    url: "/bank-lines",
    headers: { "idempotency-key": key },
    payload,
  });

  assert.equal(first.statusCode, 201);
  const firstBody = first.json();

  const second = await app.inject({
    method: "POST",
    url: "/bank-lines",
    headers: { "idempotency-key": key },
    payload,
  });

  assert.equal(second.statusCode, 201);
  assert.equal(second.headers.etag, first.headers.etag);
  assert.deepEqual(second.json(), firstBody);

  const conflict = await app.inject({
    method: "POST",
    url: "/bank-lines",
    headers: { "idempotency-key": key },
    payload: { value: "different" },
  });

  assert.equal(conflict.statusCode, 400);
  assert.equal(conflict.json().error, "idempotency_key_conflict");
});
