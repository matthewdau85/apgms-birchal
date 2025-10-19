import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import Fastify from "fastify";
import idempotencyPlugin from "../src/plugins/idempotency";
import webhooksRoutes from "../src/routes/webhooks";
import { InMemoryRedis } from "../src/lib/redis";

const SECRET = "test-secret";

function createSignature(timestamp: number, nonce: string, body: unknown) {
  const serialized = JSON.stringify(body);
  return crypto.createHmac("sha256", SECRET).update(`${timestamp}|${nonce}|${serialized}`).digest("hex");
}

async function buildApp() {
  const app = Fastify();
  const redis = new InMemoryRedis();
  process.env.WEBHOOK_HMAC_SECRET = SECRET;
  app.addContentTypeParser("application/json", { parseAs: "string" }, (request, body, done) => {
    (request as typeof request & { rawBody?: string }).rawBody = body;
    try {
      done(null, body.length ? JSON.parse(body) : {});
    } catch (err) {
      done(err as Error);
    }
  });
  await idempotencyPlugin(app, { redis, ttlSeconds: 60 });
  await webhooksRoutes(app);
  await app.ready();
  return { app, redis };
}

test("returns cached response on replay with same payload", async () => {
  const { app, redis } = await buildApp();

  try {
    const payload = { example: "value" };
    const rawPayload = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = "nonce-1";
    const signature = createSignature(timestamp, nonce, payload);

    const firstResponse = await app.inject({
      method: "POST",
      url: "/webhooks/payto",
      headers: {
        "content-type": "application/json",
        "x-idempotency-key": "key-1",
        "x-timestamp": String(timestamp),
        "x-nonce": nonce,
        "x-signature": signature,
      },
      payload: rawPayload,
    });

    assert.equal(firstResponse.statusCode, 202);
    assert.deepEqual(firstResponse.json(), { received: true });

    const secondResponse = await app.inject({
      method: "POST",
      url: "/webhooks/payto",
      headers: {
        "content-type": "application/json",
        "x-idempotency-key": "key-1",
        "x-timestamp": String(timestamp),
        "x-nonce": nonce,
        "x-signature": signature,
      },
      payload: rawPayload,
    });

    assert.equal(secondResponse.statusCode, 202);
    assert.deepEqual(secondResponse.json(), { received: true });
    assert.equal(secondResponse.headers["x-idempotent-replay"], "1");
  } finally {
    await app.close();
    await redis.flushall();
    await redis.quit();
  }
});

test("returns 409 on body hash mismatch", async () => {
  const { app, redis } = await buildApp();

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = "nonce-2";
    const signature = createSignature(timestamp, nonce, { foo: "bar" });

    const firstResponse = await app.inject({
      method: "POST",
      url: "/webhooks/payto",
      headers: {
        "content-type": "application/json",
        "x-idempotency-key": "key-2",
        "x-timestamp": String(timestamp),
        "x-nonce": nonce,
        "x-signature": signature,
      },
      payload: JSON.stringify({ foo: "bar" }),
    });

    assert.equal(firstResponse.statusCode, 202);

    const conflictResponse = await app.inject({
      method: "POST",
      url: "/webhooks/payto",
      headers: {
        "content-type": "application/json",
        "x-idempotency-key": "key-2",
        "x-timestamp": String(timestamp),
        "x-nonce": nonce,
        "x-signature": signature,
      },
      payload: JSON.stringify({ foo: "baz" }),
    });

    assert.equal(conflictResponse.statusCode, 409);
    assert.deepEqual(conflictResponse.json(), { error: "idempotency_conflict" });
  } finally {
    await app.close();
    await redis.flushall();
    await redis.quit();
  }
});
