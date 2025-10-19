import { strictEqual } from "node:assert/strict";
import { test } from "node:test";
import { createHmac } from "node:crypto";
import Fastify from "fastify";
import type { Redis } from "ioredis";
import { registerWebhookRoutes } from "../src/routes/webhooks";

class FakeRedis {
  private store = new Map<string, { value: string; expiresAt?: number }>();

  private getEntry(key: string) {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry;
  }

  async get(key: string): Promise<string | null> {
    const entry = this.getEntry(key);
    return entry ? entry.value : null;
  }

  async set(key: string, value: string, ...args: Array<string | number>): Promise<"OK" | null> {
    let ttlSeconds: number | undefined;
    let nx = false;
    for (let i = 0; i < args.length; i += 1) {
      const arg = args[i];
      if (typeof arg === "string") {
        const upper = arg.toUpperCase();
        if (upper === "EX") {
          ttlSeconds = Number(args[i + 1]);
          i += 1;
        } else if (upper === "NX") {
          nx = true;
        }
      }
    }
    const existing = this.getEntry(key);
    if (nx && existing) {
      return null;
    }
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
    return "OK";
  }
}

const payload = { amount: 42 };
const secret = "test-secret";

const sign = (timestamp: number, nonce: string) =>
  createHmac("sha256", secret).update(`${timestamp}.${nonce}.${JSON.stringify(payload)}`).digest("hex");

test("stale timestamp is rejected", async () => {
  process.env.WEBHOOK_SECRET = secret;
  const redis = new FakeRedis();
  const app = Fastify();
  registerWebhookRoutes(app, redis as unknown as Redis);
  await app.ready();

  const timestamp = Math.floor(Date.now() / 1000) - 600;
  const response = await app.inject({
    method: "POST",
    url: "/webhooks/payto",
    payload,
    headers: {
      "content-type": "application/json",
      "x-signature": sign(timestamp, "nonce-stale"),
      "x-nonce": "nonce-stale",
      "x-timestamp": String(timestamp),
    },
  });

  strictEqual(response.statusCode, 400);
  const body = response.json() as { error: string };
  strictEqual(body.error, "stale_timestamp");

  await app.close();
});

test("invalid signature returns unauthorized", async () => {
  process.env.WEBHOOK_SECRET = secret;
  const redis = new FakeRedis();
  const app = Fastify();
  registerWebhookRoutes(app, redis as unknown as Redis);
  await app.ready();

  const timestamp = Math.floor(Date.now() / 1000);
  const response = await app.inject({
    method: "POST",
    url: "/webhooks/payto",
    payload,
    headers: {
      "content-type": "application/json",
      "x-signature": "deadbeef",
      "x-nonce": "nonce-bad",
      "x-timestamp": String(timestamp),
    },
  });

  strictEqual(response.statusCode, 401);
  const body = response.json() as { error: string };
  strictEqual(body.error, "invalid_signature");

  await app.close();
});

test("nonce replay is rejected", async () => {
  process.env.WEBHOOK_SECRET = secret;
  const redis = new FakeRedis();
  const app = Fastify();
  registerWebhookRoutes(app, redis as unknown as Redis);
  await app.ready();

  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = "nonce-replay";
  const signature = sign(timestamp, nonce);

  const first = await app.inject({
    method: "POST",
    url: "/webhooks/payto",
    payload,
    headers: {
      "content-type": "application/json",
      "x-signature": signature,
      "x-nonce": nonce,
      "x-timestamp": String(timestamp),
    },
  });
  strictEqual(first.statusCode, 202);

  const second = await app.inject({
    method: "POST",
    url: "/webhooks/payto",
    payload,
    headers: {
      "content-type": "application/json",
      "x-signature": signature,
      "x-nonce": nonce,
      "x-timestamp": String(timestamp),
    },
  });
  strictEqual(second.statusCode, 409);
  const body = second.json() as { error: string };
  strictEqual(body.error, "nonce_replay");

  await app.close();
});

test("valid webhook returns accepted", async () => {
  process.env.WEBHOOK_SECRET = secret;
  const redis = new FakeRedis();
  const app = Fastify();
  registerWebhookRoutes(app, redis as unknown as Redis);
  await app.ready();

  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = "nonce-ok";
  const signature = sign(timestamp, nonce);

  const response = await app.inject({
    method: "POST",
    url: "/webhooks/payto",
    payload,
    headers: {
      "content-type": "application/json",
      "x-signature": signature,
      "x-nonce": nonce,
      "x-timestamp": String(timestamp),
    },
  });

  strictEqual(response.statusCode, 202);
  const body = response.json() as { accepted: boolean };
  strictEqual(body.accepted, true);

  await app.close();
});
