import assert from "node:assert/strict";
import Module from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import idempotencyPlugin, { __internal as idempotencyInternal } from "../apgms/services/api-gateway/src/plugins/idempotency";
import webhooksRoute, {
  __internal as webhookInternal,
  computeSignature,
  stringifyPayload,
} from "../apgms/services/api-gateway/src/routes/webhooks";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.NODE_PATH = [
  path.resolve(__dirname, "../apgms/node_modules"),
  process.env.NODE_PATH ?? "",
]
  .filter(Boolean)
  .join(path.delimiter);
Module._initPaths();

const buildApp = async () => {
  const { default: Fastify } = await import("../apgms/node_modules/fastify/fastify.js");
  const app = Fastify();
  await app.register(idempotencyPlugin);
  await app.register(webhooksRoute);
  await app.ready();
  return app;
};

const resetState = () => {
  process.env.WEBHOOK_SECRET = "test-secret";
  idempotencyInternal.clear();
  webhookInternal.clearNonces();
};

test("rejects replayed nonce", async (t) => {
  resetState();
  const app = await buildApp();
  t.after(async () => {
    await app.close();
  });

  const payload = { event: "invoice.created" };
  const nonce = "nonce-replay";
  const timestamp = String(Date.now());
  const signature = computeSignature(
    process.env.WEBHOOK_SECRET!,
    nonce,
    timestamp,
    stringifyPayload(payload)
  );

  const first = await app.inject({
    method: "POST",
    url: "/webhooks",
    headers: {
      "x-nonce": nonce,
      "x-timestamp": timestamp,
      "x-signature": signature,
      "idempotency-key": "key-one",
    },
    payload,
  });

  assert.equal(first.statusCode, 202);

  const second = await app.inject({
    method: "POST",
    url: "/webhooks",
    headers: {
      "x-nonce": nonce,
      "x-timestamp": timestamp,
      "x-signature": signature,
      "idempotency-key": "key-two",
    },
    payload,
  });

  assert.equal(second.statusCode, 409);
  assert.deepEqual(JSON.parse(second.payload), { error: "replay_detected" });
});

test("rejects stale timestamps", async (t) => {
  resetState();
  const app = await buildApp();
  t.after(async () => {
    await app.close();
  });

  const payload = { event: "invoice.created" };
  const nonce = "nonce-stale";
  const timestamp = String(Date.now() - 10 * 60 * 1000);
  const signature = computeSignature(
    process.env.WEBHOOK_SECRET!,
    nonce,
    timestamp,
    stringifyPayload(payload)
  );

  const response = await app.inject({
    method: "POST",
    url: "/webhooks",
    headers: {
      "x-nonce": nonce,
      "x-timestamp": timestamp,
      "x-signature": signature,
      "idempotency-key": "key-three",
    },
    payload,
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(JSON.parse(response.payload), { error: "stale_timestamp" });
});

test("rejects bad signatures", async (t) => {
  resetState();
  const app = await buildApp();
  t.after(async () => {
    await app.close();
  });

  const payload = { event: "invoice.created" };
  const nonce = "nonce-bad";
  const timestamp = String(Date.now());
  const signature = "definitely-not-valid";

  const response = await app.inject({
    method: "POST",
    url: "/webhooks",
    headers: {
      "x-nonce": nonce,
      "x-timestamp": timestamp,
      "x-signature": signature,
      "idempotency-key": "key-four",
    },
    payload,
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(JSON.parse(response.payload), { error: "invalid_signature" });
});
