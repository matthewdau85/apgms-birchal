import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import Fastify from "fastify";

import webhooksRoutes from "../src/routes/webhooks.js";
import { setNonceStore, type NonceStore } from "../src/plugins/webhook-signing.js";

const SECRET = "test-secret";

function createMemoryNonceStore(): NonceStore {
  const nonces = new Set<string>();
  return {
    async has(nonce) {
      return nonces.has(nonce);
    },
    async set(nonce) {
      nonces.add(nonce);
    },
  };
}

test("accepts valid webhook signature", async (t) => {
  process.env.WEBHOOK_SECRET = SECRET;
  setNonceStore(createMemoryNonceStore());

  const app = Fastify();
  await app.register(webhooksRoutes);

  t.after(async () => {
    await app.close();
    setNonceStore(null);
  });

  const payload = JSON.stringify({ event: "payment.settled" });
  const timestamp = new Date().toISOString();
  const nonce = "nonce-123";
  const signature = createHmac("sha256", SECRET)
    .update(`${timestamp}.${nonce}.${payload}`)
    .digest("hex");

  const response = await app.inject({
    method: "POST",
    url: "/webhooks/payto",
    payload,
    headers: {
      "content-type": "application/json",
      "x-signature": signature,
      "x-timestamp": timestamp,
      "x-nonce": nonce,
    },
  });

  assert.equal(response.statusCode, 202);
  assert.deepEqual(response.json(), { status: "accepted" });
});

test("rejects replayed webhook signature", async (t) => {
  process.env.WEBHOOK_SECRET = SECRET;
  const store = createMemoryNonceStore();
  setNonceStore(store);

  const app = Fastify();
  await app.register(webhooksRoutes);

  t.after(async () => {
    await app.close();
    setNonceStore(null);
  });

  const payload = JSON.stringify({ event: "payment.pending" });
  const timestamp = new Date().toISOString();
  const nonce = "nonce-replay";
  const signature = createHmac("sha256", SECRET)
    .update(`${timestamp}.${nonce}.${payload}`)
    .digest("hex");

  const first = await app.inject({
    method: "POST",
    url: "/webhooks/payto",
    payload,
    headers: {
      "content-type": "application/json",
      "x-signature": signature,
      "x-timestamp": timestamp,
      "x-nonce": nonce,
    },
  });

  assert.equal(first.statusCode, 202);

  const replay = await app.inject({
    method: "POST",
    url: "/webhooks/payto",
    payload,
    headers: {
      "content-type": "application/json",
      "x-signature": signature,
      "x-timestamp": timestamp,
      "x-nonce": nonce,
    },
  });

  assert.equal(replay.statusCode, 409);
  assert.deepEqual(replay.json(), { error: "replay_detected" });
});

