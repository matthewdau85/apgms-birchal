import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import type { FastifyInstance } from "fastify";

import { createApp } from "../src/app.js";
import { InMemoryRedis } from "../src/infra/redis.js";

test.describe("webhook verification", () => {
  const secret = "test-secret";
  let app: FastifyInstance;
  let redis: InMemoryRedis;

  const sign = (timestamp: string, nonce: string, body: string) =>
    crypto.createHmac("sha256", secret).update(`${timestamp}.${nonce}.${body}`).digest("hex");

  test.beforeEach(async () => {
    redis = new InMemoryRedis();
    app = await createApp({ redis, webhookSecret: secret, logger: false });
  });

  test.afterEach(async () => {
    await app.close();
    await redis.quit();
  });

  test("rejects requests with an invalid signature", async () => {
    const body = JSON.stringify({ event: "payto" });
    const timestamp = new Date().toISOString();
    const nonce = "nonce-1";

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/payto",
      payload: body,
      headers: {
        "content-type": "application/json",
        "x-signature": "0".repeat(64),
        "x-nonce": nonce,
        "x-timestamp": timestamp,
      },
    });

    assert.equal(response.statusCode, 401);
    assert.deepEqual(response.json(), { error: "invalid_signature" });
  });

  test("rejects stale timestamps", async () => {
    const body = JSON.stringify({ event: "payto" });
    const timestamp = new Date(Date.now() - 600_000).toISOString();
    const nonce = "nonce-2";
    const signature = sign(timestamp, nonce, body);

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/payto",
      payload: body,
      headers: {
        "content-type": "application/json",
        "x-signature": signature,
        "x-nonce": nonce,
        "x-timestamp": timestamp,
      },
    });

    assert.equal(response.statusCode, 409);
    assert.deepEqual(response.json(), { error: "stale_timestamp" });
  });

  test("rejects nonce reuse", async () => {
    const body = JSON.stringify({ event: "payto" });
    const timestamp = new Date().toISOString();
    const nonce = "nonce-3";
    const signature = sign(timestamp, nonce, body);

    const first = await app.inject({
      method: "POST",
      url: "/webhooks/payto",
      payload: body,
      headers: {
        "content-type": "application/json",
        "x-signature": signature,
        "x-nonce": nonce,
        "x-timestamp": timestamp,
      },
    });

    assert.equal(first.statusCode, 200);

    const replay = await app.inject({
      method: "POST",
      url: "/webhooks/payto",
      payload: body,
      headers: {
        "content-type": "application/json",
        "x-signature": signature,
        "x-nonce": nonce,
        "x-timestamp": timestamp,
      },
    });

    assert.equal(replay.statusCode, 409);
    assert.deepEqual(replay.json(), { error: "nonce_reused" });
  });

  test("accepts valid webhooks", async () => {
    const body = JSON.stringify({ event: "payto" });
    const timestamp = new Date().toISOString();
    const nonce = "nonce-4";
    const signature = sign(timestamp, nonce, body);

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/payto",
      payload: body,
      headers: {
        "content-type": "application/json",
        "x-signature": signature,
        "x-nonce": nonce,
        "x-timestamp": timestamp,
      },
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { ok: true });
  });
});
