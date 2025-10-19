import { strictEqual } from "node:assert/strict";
import { test } from "node:test";
import Fastify from "fastify";
import type { Redis } from "ioredis";
import { applyIdempotency } from "../src/plugins/idempotency";

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

test("idempotent replay returns cached response", async () => {
  const redis = new FakeRedis();
  const app = Fastify();
  await applyIdempotency(app, redis as unknown as Redis);

  let counter = 0;
  app.post("/echo", async () => {
    counter += 1;
    return { counter };
  });

  await app.ready();

  const first = await app.inject({
    method: "POST",
    url: "/echo",
    payload: { value: "one" },
    headers: { "idempotency-key": "abc" },
  });
  strictEqual(first.statusCode, 200);
  strictEqual(counter, 1);
  const cachedBody = first.json() as { counter: number };
  strictEqual(cachedBody.counter, 1);

  const second = await app.inject({
    method: "POST",
    url: "/echo",
    payload: { value: "one" },
    headers: { "idempotency-key": "abc" },
  });
  strictEqual(second.statusCode, 200);
  strictEqual(counter, 1);
  strictEqual(second.headers["x-idempotent-replay"], "true");
  strictEqual(second.payload, first.payload);

  await app.close();
});
