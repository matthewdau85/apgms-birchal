import crypto from "node:crypto";
import { Readable } from "node:stream";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import webhookPlugin from "../src/plugins/webhook";
import webhooksRoutes from "../src/routes/webhooks";

class FakeRedis {
  private store = new Map<string, string>();

  async connect() {}

  async quit() {}

  async set(
    key: string,
    value: string,
    options: { NX?: boolean; EX?: number },
  ): Promise<"OK" | null> {
    if (options?.NX && this.store.has(key)) {
      return null;
    }
    this.store.set(key, value);
    return "OK";
  }
}

function addRawBodyHook(app: FastifyInstance) {
  app.addHook("preParsing", async (request, _reply, payload) => {
    if (request.method === "GET" || request.method === "HEAD") {
      return payload;
    }

    if (typeof payload === "string") {
      request.rawBody = payload;
      return Readable.from([payload]);
    }

    if (Buffer.isBuffer(payload)) {
      request.rawBody = payload.toString("utf8");
      return Readable.from([payload]);
    }

    if (payload && typeof (payload as any).on === "function") {
      const chunks: Buffer[] = [];
      for await (const chunk of payload as any) {
        chunks.push(
          typeof chunk === "string" ? Buffer.from(chunk, "utf8") : chunk,
        );
      }
      const rawBuffer = Buffer.concat(chunks);
      request.rawBody = rawBuffer.toString("utf8");
      return Readable.from([rawBuffer]);
    }

    request.rawBody = "";
    return payload;
  });
}

async function buildApp(redis: FakeRedis) {
  const app = Fastify();
  addRawBodyHook(app);
  await app.register(webhookPlugin, { redisClient: redis });
  await app.register(webhooksRoutes);
  await app.ready();
  return app;
}

function createSignature(
  secret: string,
  timestamp: string,
  nonce: string,
  rawBody: string,
) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${nonce}.${rawBody}`)
    .digest("hex");
}

const WEBHOOK_SECRET = "test-secret";

describe("webhook anti-replay", () => {
  beforeEach(() => {
    process.env.WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.WEBHOOK_TS_SKEW_SEC = "300";
  });

  afterEach(() => {
    delete process.env.WEBHOOK_SECRET;
    delete process.env.WEBHOOK_TS_SKEW_SEC;
  });

  it("accepts a valid request", async () => {
    const redis = new FakeRedis();
    const app = await buildApp(redis);

    const body = JSON.stringify({ id: "abc123" });
    const nonce = "nonce-1";
    const timestamp = new Date().toISOString();
    const signature = createSignature(WEBHOOK_SECRET, timestamp, nonce, body);

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/payto",
      payload: body,
      headers: {
        "content-type": "application/json",
        "x-nonce": nonce,
        "x-timestamp": timestamp,
        "x-signature": signature,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });

    await app.close();
  });

  it("rejects invalid signatures", async () => {
    const redis = new FakeRedis();
    const app = await buildApp(redis);

    const body = JSON.stringify({ id: "abc123" });
    const nonce = "nonce-2";
    const timestamp = new Date().toISOString();

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/payto",
      payload: body,
      headers: {
        "content-type": "application/json",
        "x-nonce": nonce,
        "x-timestamp": timestamp,
        "x-signature": "deadbeef",
      },
    });

    expect(response.statusCode).toBe(401);

    await app.close();
  });

  it("rejects stale timestamps", async () => {
    const redis = new FakeRedis();
    const app = await buildApp(redis);

    const body = JSON.stringify({ id: "abc123" });
    const nonce = "nonce-3";
    const timestamp = new Date(Date.now() - 400_000).toISOString();
    const signature = createSignature(WEBHOOK_SECRET, timestamp, nonce, body);

    const response = await app.inject({
      method: "POST",
      url: "/webhooks/payto",
      payload: body,
      headers: {
        "content-type": "application/json",
        "x-nonce": nonce,
        "x-timestamp": timestamp,
        "x-signature": signature,
      },
    });

    expect(response.statusCode).toBe(409);

    await app.close();
  });

  it("rejects reused nonces", async () => {
    const redis = new FakeRedis();
    const app = await buildApp(redis);

    const body = JSON.stringify({ id: "abc123" });
    const nonce = "nonce-4";
    const timestamp = new Date().toISOString();
    const signature = createSignature(WEBHOOK_SECRET, timestamp, nonce, body);

    const payload = {
      method: "POST",
      url: "/webhooks/payto",
      payload: body,
      headers: {
        "content-type": "application/json",
        "x-nonce": nonce,
        "x-timestamp": timestamp,
        "x-signature": signature,
      },
    };

    const first = await app.inject(payload);
    expect(first.statusCode).toBe(200);

    const second = await app.inject(payload);
    expect(second.statusCode).toBe(409);

    await app.close();
  });
});
