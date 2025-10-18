import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import idempotencyPlugin, {
  type IdempotencyRedisClient,
} from "../src/plugins/idempotency";

class FakeRedis implements IdempotencyRedisClient {
  private readonly store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<string> {
    this.store.set(key, value);
    return "OK";
  }

  get isOpen(): boolean {
    return true;
  }

  async quit(): Promise<string> {
    this.store.clear();
    return "OK";
  }
}

async function buildApp() {
  const app = Fastify();
  await idempotencyPlugin(app, { redisClient: new FakeRedis() });

  app.post("/bank-lines", async (req, rep) => {
    return rep.code(201).send({ created: true, orgId: (req.body as any).orgId });
  });

  return app;
}

test("rejects POST without Idempotency-Key header", async (t) => {
  const app = await buildApp();
  await app.ready();
  t.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/bank-lines",
    payload: { orgId: "org-1" },
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), { error: "missing_idempotency_key" });
});

test("replays stored response for identical request", async (t) => {
  const app = await buildApp();
  await app.ready();
  t.after(() => app.close());

  const payload = { orgId: "org-1", amount: 10 };
  const first = await app.inject({
    method: "POST",
    url: "/bank-lines",
    headers: { "Idempotency-Key": "abc123" },
    payload,
  });

  assert.equal(first.statusCode, 201);
  assert.deepEqual(first.json(), { created: true, orgId: "org-1" });

  const replay = await app.inject({
    method: "POST",
    url: "/bank-lines",
    headers: { "Idempotency-Key": "abc123" },
    payload,
  });

  assert.equal(replay.statusCode, 200);
  assert.equal(replay.headers["x-idempotent-replay"], "true");
  assert.deepEqual(replay.json(), { created: true, orgId: "org-1" });
});

test("conflicting payloads return 409", async (t) => {
  const app = await buildApp();
  await app.ready();
  t.after(() => app.close());

  await app.inject({
    method: "POST",
    url: "/bank-lines",
    headers: { "Idempotency-Key": "conflict" },
    payload: { orgId: "org-1", amount: 10 },
  });

  const response = await app.inject({
    method: "POST",
    url: "/bank-lines",
    headers: { "Idempotency-Key": "conflict" },
    payload: { orgId: "org-1", amount: 20 },
  });

  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.json(), { error: "idempotency_conflict" });
});
