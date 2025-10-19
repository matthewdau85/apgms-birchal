import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import Redis from "ioredis";
import { buildApp } from "../src/app";

const WEBHOOK_SECRET = "supersecret";

function signPayload(params: {
  secret: string;
  method: string;
  path: string;
  body: object | string;
  nonce: string;
  timestamp: string;
}) {
  const bodyString = typeof params.body === "string" ? params.body : JSON.stringify(params.body);
  const digest = createHash("sha256").update(bodyString).digest("hex");
  const payload = [params.method.toUpperCase(), params.path, digest, params.nonce, params.timestamp].join("|");
  return createHmac("sha256", params.secret).update(payload).digest("hex");
}

test("POST /bank-lines caches 201 responses by idempotency key", async (t) => {
  const redis = new Redis();
  await redis.connect();
  const calls: unknown[] = [];
  const prismaStub = {
    user: {
      findMany: async () => [],
    },
    bankLine: {
      findMany: async () => [],
      create: async (args: any) => {
        calls.push(args);
        return {
          id: "line_123",
          ...args.data,
        };
      },
    },
  };
  const app = await buildApp({
    redisClient: redis,
    webhookSecret: WEBHOOK_SECRET,
    logger: false,
    prismaClient: prismaStub,
  });

  t.after(async () => {
    await app.close();
  });

  const payload = {
    orgId: "org_1",
    date: new Date().toISOString(),
    amount: 100,
    payee: "ACME",
    desc: "Test",
  };

  const first = await app.inject({
    method: "POST",
    url: "/bank-lines",
    payload,
    headers: {
      "content-type": "application/json",
      "idempotency-key": "idem-1",
    },
  });

  assert.equal(first.statusCode, 201);
  const firstBody = first.json();

  const second = await app.inject({
    method: "POST",
    url: "/bank-lines",
    payload,
    headers: {
      "content-type": "application/json",
      "idempotency-key": "idem-1",
    },
  });

  assert.equal(second.statusCode, 201);
  assert.deepEqual(second.json(), firstBody);
  assert.equal(calls.length, 1);
});

test("POST /webhooks/payto rejects stale timestamps", async () => {
  const redis = new Redis();
  await redis.connect();
  const app = await buildApp({
    redisClient: redis,
    webhookSecret: WEBHOOK_SECRET,
    logger: false,
    prismaClient: createNoopPrisma(),
  });

  const timestamp = String(Math.floor(Date.now() / 1000) - 400);
  const nonce = "nonce-stale";
  const body = { event: "stale" };
  const signature = signPayload({
    secret: WEBHOOK_SECRET,
    method: "POST",
    path: "/webhooks/payto",
    body,
    nonce,
    timestamp,
  });

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

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, "stale_timestamp");

  await app.close();
});

test("POST /webhooks/payto rejects nonce replays", async () => {
  const redis = new Redis();
  await redis.connect();
  const app = await buildApp({
    redisClient: redis,
    webhookSecret: WEBHOOK_SECRET,
    logger: false,
    prismaClient: createNoopPrisma(),
  });

  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = "nonce-repeat";
  const body = { event: "nonce" };
  const signature = signPayload({
    secret: WEBHOOK_SECRET,
    method: "POST",
    path: "/webhooks/payto",
    body,
    nonce,
    timestamp,
  });

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

  const second = await app.inject({
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

  assert.equal(second.statusCode, 409);
  assert.equal(second.json().error, "nonce_replay");

  await app.close();
});

test("POST /webhooks/payto rejects invalid signatures", async () => {
  const redis = new Redis();
  await redis.connect();
  const app = await buildApp({
    redisClient: redis,
    webhookSecret: WEBHOOK_SECRET,
    logger: false,
    prismaClient: createNoopPrisma(),
  });

  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = "nonce-invalid";
  const body = { event: "sig" };

  const response = await app.inject({
    method: "POST",
    url: "/webhooks/payto",
    payload: body,
    headers: {
      "content-type": "application/json",
      "x-signature": "deadbeef",
      "x-nonce": nonce,
      "x-timestamp": timestamp,
    },
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().error, "invalid_signature");

  await app.close();
});

function createNoopPrisma() {
  return {
    user: {
      findMany: async () => [],
    },
    bankLine: {
      findMany: async () => [],
      create: async () => ({ id: "noop" }),
    },
  };
}
