import test from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";

async function createApp(options?: any) {
  const mod = await import("../src/index.ts");
  return mod.buildApp(options);
}

test("disallowed origins are blocked by CORS", async (t) => {
  process.env.ALLOWED_ORIGINS = "http://allowed.local";

  const app = await createApp({
    prismaClient: {
      user: { findMany: async () => [] },
      bankLine: { findMany: async () => [], create: async () => ({}) },
    },
  });
  t.after(async () => {
    await app.close();
  });

  await app.ready();

  const response = await app.inject({
    method: "OPTIONS",
    url: "/health",
    headers: {
      origin: "http://attacker.example",
      "access-control-request-method": "GET",
    },
  });

  assert.equal(response.statusCode, 403);
});

test("mutation requests emit audit logs including request id", async (t) => {
  process.env.ALLOWED_ORIGINS = "http://allowed.local";

  const app = await createApp({
    prismaClient: {
      user: { findMany: async () => [] },
      bankLine: { findMany: async () => [], create: async () => ({}) },
    },
    extend: (instance) => {
      instance.post("/__audit-test", async () => ({ ok: true }));
    },
  });
  const originalInfo = app.log.info;
  const entries: any[] = [];

  app.log.info = function (...args: any[]) {
    entries.push(args[0]);
    return originalInfo.apply(this, args as any);
  } as any;

  t.after(async () => {
    app.log.info = originalInfo;
    await app.close();
  });

  await app.ready();

  const response = await app.inject({
    method: "POST",
    url: "/__audit-test",
    headers: {
      origin: "http://allowed.local",
      "x-request-id": "audit-test-id",
    },
    payload: { foo: "bar" },
  });

  assert.equal(response.statusCode, 200);

  const auditEntry = entries.find(
    (entry) => entry && typeof entry === "object" && entry.audit === true,
  );

  assert.ok(auditEntry, "expected an audit log entry");
  assert.equal(auditEntry.reqId, "audit-test-id");
});
