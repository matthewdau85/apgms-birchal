import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";
import Fastify from "fastify";
import webhooksRoutes from "../src/routes/webhooks";
import { InMemoryNonceStore } from "../src/plugins/webhook-signing";

const SECRET = "test-secret";

const signPayload = (timestamp: string, nonce: string, body: string) =>
  crypto.createHmac("sha256", SECRET).update(`${timestamp}.${nonce}.${body}`).digest("hex");

const buildApp = async () => {
  const app = Fastify();
  await app.register(webhooksRoutes, { secret: SECRET, redis: new InMemoryNonceStore() });
  await app.ready();
  return app;
};

test("accepts a valid webhook request", async (t) => {
  const app = await buildApp();
  t.after(() => app.close());

  const body = JSON.stringify({ amount: 100 });
  const timestamp = new Date().toISOString();
  const nonce = crypto.randomBytes(16).toString("hex");
  const signature = signPayload(timestamp, nonce, body);

  const response = await app.inject({
    method: "POST",
    url: "/webhooks/payto",
    payload: body,
    headers: {
      "content-type": "application/json",
      "x-signature": signature,
      "x-timestamp": timestamp,
      "x-nonce": nonce,
    },
  });

  assert.equal(response.statusCode, 202);
});

test("rejects stale webhook requests", async (t) => {
  const app = await buildApp();
  t.after(() => app.close());

  const body = JSON.stringify({ amount: 100 });
  const timestamp = new Date(Date.now() - 301_000).toISOString();
  const nonce = crypto.randomBytes(16).toString("hex");
  const signature = signPayload(timestamp, nonce, body);

  const response = await app.inject({
    method: "POST",
    url: "/webhooks/payto",
    payload: body,
    headers: {
      "content-type": "application/json",
      "x-signature": signature,
      "x-timestamp": timestamp,
      "x-nonce": nonce,
    },
  });

  assert.equal(response.statusCode, 401);
});

test("rejects replayed webhook requests", async (t) => {
  const app = await buildApp();
  t.after(() => app.close());

  const body = JSON.stringify({ amount: 100 });
  const timestamp = new Date().toISOString();
  const nonce = crypto.randomBytes(16).toString("hex");
  const signature = signPayload(timestamp, nonce, body);

  const first = await app.inject({
    method: "POST",
    url: "/webhooks/payto",
    payload: body,
    headers: {
      "content-type": "application/json",
      "x-signature": signature,
      "x-timestamp": timestamp,
      "x-nonce": nonce,
    },
  });

  assert.equal(first.statusCode, 202);

  const second = await app.inject({
    method: "POST",
    url: "/webhooks/payto",
    payload: body,
    headers: {
      "content-type": "application/json",
      "x-signature": signature,
      "x-timestamp": timestamp,
      "x-nonce": nonce,
    },
  });

  assert.equal(second.statusCode, 409);
});

test("rejects invalid signatures", async (t) => {
  const app = await buildApp();
  t.after(() => app.close());

  const body = JSON.stringify({ amount: 100 });
  const timestamp = new Date().toISOString();
  const nonce = crypto.randomBytes(16).toString("hex");
  const badSignature = "00".repeat(32);

  const response = await app.inject({
    method: "POST",
    url: "/webhooks/payto",
    payload: body,
    headers: {
      "content-type": "application/json",
      "x-signature": badSignature,
      "x-timestamp": timestamp,
      "x-nonce": nonce,
    },
  });

  assert.equal(response.statusCode, 401);
});
