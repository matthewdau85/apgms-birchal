import assert from "node:assert/strict";
import test from "node:test";
import type { FastifyInstance } from "fastify";

import { prisma } from "../../../shared/src/db";
import { createApp } from "../src/app.js";
import { InMemoryRedis } from "../src/infra/redis.js";

test.describe("idempotency plugin", () => {
  let app: FastifyInstance;
  let redis: InMemoryRedis;
  let originalCreate: typeof prisma.bankLine.create;
  let createCalls = 0;

  test.beforeEach(async () => {
    redis = new InMemoryRedis();
    originalCreate = prisma.bankLine.create;
    createCalls = 0;
    prisma.bankLine.create = (async () => {
      createCalls += 1;
      return {
        id: "line_123",
        orgId: "org_1",
        date: new Date("2024-01-01T00:00:00.000Z"),
        amount: 100,
        payee: "ACME",
        desc: "Test",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        updatedAt: new Date("2024-01-01T00:00:00.000Z"),
        externalId: null,
      } as any;
    }) as typeof prisma.bankLine.create;

    app = await createApp({ redis, webhookSecret: "test-secret", logger: false });
  });

  test.afterEach(async () => {
    await app.close();
    await redis.quit();
    prisma.bankLine.create = originalCreate;
  });

  test("replays cached response when request hash matches", async () => {
    const payload = {
      orgId: "org_1",
      date: "2024-01-01",
      amount: 100,
      payee: "ACME",
      desc: "Test",
    };

    const first = await app.inject({
      method: "POST",
      url: "/bank-lines",
      headers: { "idempotency-key": "abc123", "content-type": "application/json" },
      payload,
    });

    assert.equal(first.statusCode, 201);
    const cached = await redis.get("idempotency:abc123");
    assert.ok(cached);
    const etag = first.headers["etag"];
    const firstBody = first.json();

    const second = await app.inject({
      method: "POST",
      url: "/bank-lines",
      headers: { "idempotency-key": "abc123", "content-type": "application/json" },
      payload,
    });

    assert.equal(second.statusCode, 201);
    assert.equal(second.headers["etag"], etag);
    assert.deepEqual(second.json(), firstBody);
    assert.equal(createCalls, 1);
  });

  test("rejects conflicting payload with same idempotency key", async () => {
    const payload = {
      orgId: "org_1",
      date: "2024-01-01",
      amount: 100,
      payee: "ACME",
      desc: "Test",
    };

    const first = await app.inject({
      method: "POST",
      url: "/bank-lines",
      headers: { "idempotency-key": "abc123", "content-type": "application/json" },
      payload,
    });

    assert.equal(first.statusCode, 201);

    const conflict = await app.inject({
      method: "POST",
      url: "/bank-lines",
      headers: { "idempotency-key": "abc123", "content-type": "application/json" },
      payload: { ...payload, amount: 200 },
    });

    assert.equal(conflict.statusCode, 400);
    assert.deepEqual(conflict.json(), { error: "idempotency_conflict" });
    assert.equal(createCalls, 1);
  });
});
