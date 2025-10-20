import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import Fastify from "fastify";
import webhookPlugin from "../src/plugins/webhook.ts";

class InMemoryRedis {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, mode?: "PX" | "EX", ttl?: number): Promise<string> {
    let expiresAt: number | undefined;
    if (mode === "PX" && typeof ttl === "number") {
      expiresAt = Date.now() + ttl;
    }
    if (mode === "EX" && typeof ttl === "number") {
      expiresAt = Date.now() + ttl * 1000;
    }
    this.store.set(key, { value, expiresAt });
    return "OK";
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

const secret = "test-secret";
const payload = { amount: 125.5, currency: "AUD" };

function sign(nonce: string, timestamp: number, body = payload) {
  const bodyString = JSON.stringify(body);
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${nonce}.${bodyString}`)
    .digest("hex");
}

async function createApp() {
  const redis = new InMemoryRedis();
  const app = Fastify();
  await webhookPlugin(app, { secret, redis });
  app.post("/webhooks/payto", async (_, reply) => reply.code(200).send({ ok: true }));
  return { app, redis };
}

test("rejects requests with stale timestamps", async (t) => {
  const { app, redis } = await createApp();
  t.after(async () => {
    await app.close();
    await redis.clear();
  });

  const nonce = "stale-1";
  const timestamp = Date.now() - 6 * 60 * 1000;
  const signature = sign(nonce, timestamp);

  const response = await app.inject({
    method: "POST",
    url: "/webhooks/payto",
    payload,
    headers: {
      "content-type": "application/json",
      "x-nonce": nonce,
      "x-timestamp": String(timestamp),
      "x-signature": signature,
    },
  });

  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.json(), { error: "stale_timestamp" });
});

test("rejects requests that reuse a nonce", async (t) => {
  const { app, redis } = await createApp();
  t.after(async () => {
    await app.close();
    await redis.clear();
  });

  const nonce = "reuse-1";
  const timestamp = Date.now();
  const signature = sign(nonce, timestamp);

  const first = await app.inject({
    method: "POST",
    url: "/webhooks/payto",
    payload,
    headers: {
      "content-type": "application/json",
      "x-nonce": nonce,
      "x-timestamp": String(timestamp),
      "x-signature": signature,
    },
  });
  assert.equal(first.statusCode, 200);

  const second = await app.inject({
    method: "POST",
    url: "/webhooks/payto",
    payload,
    headers: {
      "content-type": "application/json",
      "x-nonce": nonce,
      "x-timestamp": String(timestamp),
      "x-signature": signature,
    },
  });

  assert.equal(second.statusCode, 409);
  assert.deepEqual(second.json(), { error: "nonce_reused" });
});

test("rejects requests with invalid signatures", async (t) => {
  const { app, redis } = await createApp();
  t.after(async () => {
    await app.close();
    await redis.clear();
  });

  const nonce = "bad-sig";
  const timestamp = Date.now();

  const response = await app.inject({
    method: "POST",
    url: "/webhooks/payto",
    payload,
    headers: {
      "content-type": "application/json",
      "x-nonce": nonce,
      "x-timestamp": String(timestamp),
      "x-signature": "not-valid",
    },
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), { error: "invalid_signature" });
});

test("accepts valid webhook requests", async (t) => {
  const { app, redis } = await createApp();
  t.after(async () => {
    await app.close();
    await redis.clear();
  });

  const nonce = "ok-1";
  const timestamp = Date.now();
  const signature = sign(nonce, timestamp);

  const response = await app.inject({
    method: "POST",
    url: "/webhooks/payto",
    payload,
    headers: {
      "content-type": "application/json",
      "x-nonce": nonce,
      "x-timestamp": String(timestamp),
      "x-signature": signature,
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ok: true });
});
