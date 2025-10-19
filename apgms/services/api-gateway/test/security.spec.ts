import { test } from "node:test";
import assert from "node:assert/strict";

process.env.NODE_ENV = "test";
process.env.ALLOWED_ORIGINS = "http://allowed.test";

const { buildApp } = await import("../src/index.ts");

const disallowedOrigin = "http://evil.test";

test("disallowed origins are blocked by CORS", async (t) => {
  const app = await buildApp();
  t.after(async () => {
    await app.close();
  });
  await app.ready();

  const response = await app.inject({
    method: "OPTIONS",
    url: "/health",
    headers: {
      origin: disallowedOrigin,
      "access-control-request-method": "GET",
    },
  });

  assert.equal(response.headers["access-control-allow-origin"], undefined);
  assert.notEqual(response.statusCode, 200);
});

test("mutation requests emit audit log entries with request ids", async (t) => {
  const app = await buildApp();
  const originalInfo = app.log.info;
  t.after(async () => {
    (app.log as any).info = originalInfo;
    await app.close();
  });

  const infoCalls: any[][] = [];
  (app.log as any).info = function (...args: any[]) {
    infoCalls.push(args);
    return originalInfo.apply(this, args);
  };

  await app.register(async (instance) => {
    instance.post("/__test__", async (_req, reply) => {
      return reply.send({ ok: true });
    });
  });

  await app.ready();

  const response = await app.inject({
    method: "POST",
    url: "/__test__",
    headers: {
      "x-request-id": "test-req-id",
    },
    payload: { ok: true },
  });

  assert.equal(response.statusCode, 200);
  const auditCall = infoCalls.find(([entry]) => entry?.audit === true);
  assert.ok(auditCall, "expected an audit log entry");
  const [logEntry] = auditCall!;
  assert.equal(logEntry.reqId, "test-req-id");
  assert.equal(logEntry.method, "POST");
  assert.equal(logEntry.url, "/__test__");
  assert.equal(logEntry.statusCode, 200);
});
