import { createHmac } from "node:crypto";
import assert from "node:assert/strict";
import { test } from "node:test";
import Fastify from "fastify";

import webhookSigningPlugin, { InMemoryNonceStore } from "../src/plugins/webhook-signing";
import webhooksRoutes from "../src/routes/webhooks";

const TEST_SECRET = "super-secret";

const buildApp = async (clock: () => Date) => {
  const app = Fastify();

  await webhookSigningPlugin(app, {
    secret: TEST_SECRET,
    redis: new InMemoryNonceStore(),
    clock,
  });

  await app.register(webhooksRoutes);

  return app;
};

const signPayload = (timestamp: string, nonce: string, rawBody: string): string => {
  const hmac = createHmac("sha256", TEST_SECRET);
  hmac.update(`${timestamp}.${nonce}.${rawBody}`);
  return hmac.digest("hex");
};

test("accepts valid webhook payload", async (t) => {
  const now = new Date("2024-01-01T00:00:00.000Z");
  const app = await buildApp(() => new Date(now));
  t.after(async () => {
    await app.close();
  });

  const payload = JSON.stringify({ event: "payment" });
  const nonce = "abc123";
  const timestamp = now.toISOString();
  const signature = signPayload(timestamp, nonce, payload);

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
  assert.deepEqual(response.json(), { accepted: true });
});

test("rejects stale timestamps", async (t) => {
  const now = new Date("2024-01-01T00:10:00.000Z");
  const app = await buildApp(() => new Date(now));
  t.after(async () => {
    await app.close();
  });

  const payload = JSON.stringify({ event: "stale" });
  const nonce = "stale-nonce";
  const timestamp = new Date(now.getTime() - 301_000).toISOString();
  const signature = signPayload(timestamp, nonce, payload);

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

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), { error: "timestamp_out_of_range" });
});

test("rejects replayed nonces", async (t) => {
  const now = new Date("2024-01-01T00:00:30.000Z");
  const app = await buildApp(() => new Date(now));
  t.after(async () => {
    await app.close();
  });

  const payload = JSON.stringify({ event: "replay" });
  const nonce = "nonce-1";
  const timestamp = now.toISOString();
  const signature = signPayload(timestamp, nonce, payload);

  const request = {
    method: "POST" as const,
    url: "/webhooks/payto",
    payload,
    headers: {
      "content-type": "application/json",
      "x-signature": signature,
      "x-timestamp": timestamp,
      "x-nonce": nonce,
    },
  };

  const first = await app.inject(request);
  assert.equal(first.statusCode, 202);

  const replay = await app.inject(request);
  assert.equal(replay.statusCode, 409);
  assert.deepEqual(replay.json(), { error: "nonce_reused" });
});

test("rejects invalid HMAC", async (t) => {
  const now = new Date("2024-01-01T00:05:00.000Z");
  const app = await buildApp(() => new Date(now));
  t.after(async () => {
    await app.close();
  });

  const payload = JSON.stringify({ event: "tampered" });
  const nonce = "nonce-2";
  const timestamp = now.toISOString();
  const signature = signPayload(timestamp, nonce, payload);

  const response = await app.inject({
    method: "POST",
    url: "/webhooks/payto",
    payload,
    headers: {
      "content-type": "application/json",
      "x-signature": signature.replace(/.$/, (char) => (char === "0" ? "1" : "0")),
      "x-timestamp": timestamp,
      "x-nonce": nonce,
    },
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), { error: "invalid_signature" });
});
