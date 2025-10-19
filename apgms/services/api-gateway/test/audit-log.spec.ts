import { test } from "node:test";
import assert from "node:assert/strict";
import { Writable } from "node:stream";
import Fastify from "fastify";
import auditLog from "../src/plugins/audit-log.js";

type AuditEntry = Record<string, any>;

const createLogger = (collector: AuditEntry[]) => {
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      const str = chunk.toString();
      for (const line of str.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        collector.push(JSON.parse(trimmed));
      }
      callback();
    },
  });

  return { stream };
};

test("logs ALLOW decision for successful protected route", async () => {
  const logs: AuditEntry[] = [];
  const { stream } = createLogger(logs);

  const app = Fastify({
    logger: {
      level: "info",
      stream: stream as unknown as NodeJS.WritableStream,
    },
  });

  await auditLog(app);

  app.addHook("preHandler", (request, _reply, done) => {
    request.user = { id: "user-123", orgId: "org-abc" };
    done();
  });

  app.get(
    "/protected",
    {
      config: {
        audit: { protected: true },
      },
    },
    async () => ({ ok: true }),
  );

  await app.ready();

  const response = await app.inject({ method: "GET", url: "/protected" });
  assert.equal(response.statusCode, 200);

  await new Promise((resolve) => setTimeout(resolve, 10));

  const auditLogs = logs.filter((entry) => entry.component === "audit");
  assert.equal(auditLogs.length, 1);
  const entry = auditLogs[0];

  assert.equal(entry.decision, "ALLOW");
  assert.equal(entry.status, 200);
  assert.equal(entry.method, "GET");
  assert.equal(entry.route, "/protected");
  assert.equal(entry.user_id, "user-123");
  assert.equal(entry.org_id, "org-abc");
  assert.equal(entry.ip, "127.0.0.1");
  assert.equal(entry.user_agent, "lightMyRequest");
  assert.equal(entry.req_id.startsWith("req-"), true);
  assert.equal(typeof entry.latency_ms, "number");
  assert.equal(typeof entry.ts, "string");

  await app.close();
});

test("logs DENY decision for forbidden protected route with redacted body", async () => {
  const logs: AuditEntry[] = [];
  const { stream } = createLogger(logs);

  const app = Fastify({
    logger: {
      level: "info",
      stream: stream as unknown as NodeJS.WritableStream,
    },
  });

  await auditLog(app);

  app.addHook("preHandler", (request, _reply, done) => {
    request.user = { id: "user-123", orgId: "org-abc" };
    done();
  });

  app.post(
    "/protected-deny",
    {
      config: {
        audit: { protected: true },
      },
    },
    async (_request, reply) => reply.code(403).send({ error: "forbidden" }),
  );

  await app.ready();

  const response = await app.inject({
    method: "POST",
    url: "/protected-deny",
    payload: {
      password: "secret",
      card: "4111111111111111",
      note: "hello",
    },
  });
  assert.equal(response.statusCode, 403);

  await new Promise((resolve) => setTimeout(resolve, 10));

  const auditLogs = logs.filter((entry) => entry.component === "audit");
  assert.equal(auditLogs.length, 1);
  const entry = auditLogs[0];

  assert.equal(entry.decision, "DENY");
  assert.equal(entry.status, 403);
  assert.equal(entry.reason, "status_403");
  assert.equal(entry.method, "POST");
  assert.equal(entry.route, "/protected-deny");
  assert.equal(entry.user_id, "user-123");
  assert.equal(entry.org_id, "org-abc");
  assert.equal(entry.ip, "127.0.0.1");
  assert.equal(entry.user_agent, "lightMyRequest");
  assert.equal(entry.req_id.startsWith("req-"), true);
  assert.equal(typeof entry.latency_ms, "number");
  assert.equal(typeof entry.ts, "string");

  assert.ok(entry.body);
  assert.equal("password" in entry.body, false);
  assert.equal("card" in entry.body, false);
  assert.equal(entry.body.note, "hello");

  await app.close();
});
