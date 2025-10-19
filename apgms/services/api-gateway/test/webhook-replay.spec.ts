import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import Fastify from "fastify";
import test from "node:test";
import webhooksRoutes, { canonicalJson } from "../src/routes/webhooks";
import { redis } from "../src/redis";

const secret = "test-secret";

function sign(body: unknown, nonce: string, timestamp: number) {
  const canonicalBody = canonicalJson(body);
  const signature = createHmac("sha256", secret).update(canonicalBody).digest("hex");
  return {
    payload: body,
    headers: {
      "x-signature": signature,
      "x-nonce": nonce,
      "x-timestamp": String(timestamp),
    },
  };
}

test("accepts a valid webhook", { concurrency: false }, async () => {
  process.env.WEBHOOK_SECRET = secret;
  await redis.flushall();
  const app = Fastify();
  await webhooksRoutes(app, { prefix: "/webhooks" });
  const now = Math.floor(Date.now() / 1000);
  const { payload, headers } = sign({ amount: 100, currency: "AUD" }, "nonce-1", now);

  const response = await app.inject({
    method: "POST",
    url: "/webhooks/payto",
    payload,
    headers,
  });

  assert.equal(response.statusCode, 202);
  assert.deepEqual(response.json(), { status: "accepted" });
  await app.close();
});

test("rejects a replayed nonce", { concurrency: false }, async () => {
  process.env.WEBHOOK_SECRET = secret;
  await redis.flushall();
  const app = Fastify();
  await webhooksRoutes(app, { prefix: "/webhooks" });
  const now = Math.floor(Date.now() / 1000);
  const nonce = "nonce-2";
  const first = sign({ id: 1 }, nonce, now);

  const firstResponse = await app.inject({
    method: "POST",
    url: "/webhooks/payto",
    payload: first.payload,
    headers: first.headers,
  });
  assert.equal(firstResponse.statusCode, 202);

  const secondResponse = await app.inject({
    method: "POST",
    url: "/webhooks/payto",
    payload: first.payload,
    headers: first.headers,
  });

  assert.equal(secondResponse.statusCode, 409);
  assert.deepEqual(secondResponse.json(), { error: "replayed_nonce" });
  await app.close();
});

test("rejects stale timestamps", { concurrency: false }, async () => {
  process.env.WEBHOOK_SECRET = secret;
  await redis.flushall();
  const app = Fastify();
  await webhooksRoutes(app, { prefix: "/webhooks" });
  const stale = Math.floor(Date.now() / 1000) - 301;
  const { payload, headers } = sign({ id: 2 }, "nonce-3", stale);

  const response = await app.inject({
    method: "POST",
    url: "/webhooks/payto",
    payload,
    headers,
  });

  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.json(), { error: "stale_timestamp" });
  await app.close();
});
