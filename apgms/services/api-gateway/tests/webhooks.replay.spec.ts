import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import Fastify from "fastify";
import idempotencyPlugin from "../src/plugins/idempotency";
import webhooksRoutes from "../src/routes/webhooks";
import { InMemoryRedis } from "../src/lib/redis";

const SECRET = "test-secret";

function serializeBody(body: unknown) {
  return JSON.stringify(body);
}

function createSignature(timestamp: number, nonce: string, body: unknown) {
  const serialized = serializeBody(body);
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

test("rejects stale timestamps", async () => {
  const { app, redis } = await buildApp();

  try {
    const payload = { id: "123" };
    const rawPayload = serializeBody(payload);
    const timestamp = Math.floor(Date.now() / 1000) - 600;
    const nonce = "nonce-stale";
    const signature = createSignature(timestamp, nonce, payload);

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/payto",
      headers: {
        "content-type": "application/json",
        "x-idempotency-key": "key-stale",
        "x-timestamp": String(timestamp),
        "x-nonce": nonce,
        "x-signature": signature,
      },
      payload: rawPayload,
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json(), { error: "stale_timestamp" });
  } finally {
    await app.close();
    await redis.flushall();
    await redis.quit();
  }
});

test("rejects nonce replays", async () => {
  const { app, redis } = await buildApp();

  try {
    const payload = { id: "123" };
    const rawPayload = serializeBody(payload);
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = "nonce-repeat";
    const signature = createSignature(timestamp, nonce, payload);

    const firstResponse = await app.inject({
      method: "POST",
      url: "/webhooks/payto",
      headers: {
        "content-type": "application/json",
        "x-idempotency-key": "key-nonce-1",
        "x-timestamp": String(timestamp),
        "x-nonce": nonce,
        "x-signature": signature,
      },
      payload: rawPayload,
    });

    assert.equal(firstResponse.statusCode, 202);

    const secondResponse = await app.inject({
      method: "POST",
      url: "/webhooks/payto",
      headers: {
        "content-type": "application/json",
        "x-idempotency-key": "key-nonce-2",
        "x-timestamp": String(timestamp),
        "x-nonce": nonce,
        "x-signature": signature,
      },
      payload: rawPayload,
    });

    assert.equal(secondResponse.statusCode, 409);
    assert.deepEqual(secondResponse.json(), { error: "nonce_replay" });
  } finally {
    await app.close();
    await redis.flushall();
    await redis.quit();
  }
});

test("rejects invalid signatures", async () => {
  const { app, redis } = await buildApp();

  try {
    const payload = { id: "123" };
    const rawPayload = serializeBody(payload);
    const timestamp = Math.floor(Date.now() / 1000);
    const nonce = "nonce-bad";
    const signature = "deadbeef";

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/payto",
      headers: {
        "content-type": "application/json",
        "x-idempotency-key": "key-bad",
        "x-timestamp": String(timestamp),
        "x-nonce": nonce,
        "x-signature": signature,
      },
      payload: rawPayload,
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.json(), { error: "invalid_signature" });
  } finally {
    await app.close();
    await redis.flushall();
    await redis.quit();
  }
});
