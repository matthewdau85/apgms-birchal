import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { Writable } from "node:stream";
import { readFileSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import auditLogPlugin from "../src/plugins/audit-log";

type Line = ReturnType<typeof JSON.parse>;

class ArrayWritable extends Writable {
  public readonly lines: string[] = [];

  _write(chunk: any, _encoding: BufferEncoding, callback: (error?: Error | null) => void) {
    this.lines.push(chunk.toString());
    callback();
  }
}

const createDeterministicClock = () => {
  const base = Date.parse("2024-01-01T00:00:00.000Z");
  let tick = 0;
  return () => new Date(base + tick++);
};

test("records allow and deny decisions with sanitized output", async () => {
  const stream = new ArrayWritable();
  const clock = createDeterministicClock();
  const app = Fastify();
  await app.register(auditLogPlugin, { stream, clock });

  app.get("/users/:userId", async (request) => {
    request.audit.setActor({ userId: "user-123", orgId: "org-789" });
    request.audit.recordRptMint("rpt-1", { policyId: "policy-1" });
    request.audit.recordDecision("ALLOW", { reason: "policy:allow", policyId: "policy-1" });
    return { ok: true };
  });

  app.post("/tenants/:tenantId/policies", async (request, reply) => {
    request.audit.setActor({ userId: "user-321", orgId: "org-111" });
    request.audit.recordDecision("DENY", { reason: "user@example.com", policyId: "policy-2" });
    reply.code(403).send({ error: "denied" });
  });

  await app.ready();

  const allowResponse = await app.inject({ method: "GET", url: "/users/999?email=test@example.com" });
  assert.equal(allowResponse.statusCode, 200);
  const denyResponse = await app.inject({ method: "POST", url: "/tenants/000000001/policies" });
  assert.equal(denyResponse.statusCode, 403);

  assert.equal(stream.lines.length, 2);

  const allowLog = JSON.parse(stream.lines[0]) as Line;
  assert.equal(allowLog.decision, "ALLOW");
  assert.equal(allowLog.reason, "policy:allow");
  assert.equal(allowLog.route, "/users/:userId");
  assert.equal(allowLog.user_id, "user-123");
  assert.equal(allowLog.org_id, "org-789");
  assert.equal(Array.isArray(allowLog.audit_blob), true);
  assert.equal(allowLog.audit_blob.length, 2);
  assert.equal(allowLog.audit_blob[0].type, "rpt-mint");
  assert.equal(allowLog.audit_blob[1].type, "policy-decision");
  assert.equal(allowLog.audit_blob[1].prev_hash, allowLog.audit_blob[0].hash);
  assert.ok(!JSON.stringify(allowLog).includes("test@example.com"));

  const denyLog = JSON.parse(stream.lines[1]) as Line;
  assert.equal(denyLog.decision, "DENY");
  assert.equal(denyLog.reason, "[REDACTED]");
  assert.equal(denyLog.status, 403);
  assert.equal(denyLog.route, "/tenants/:tenantId/policies");
  assert.ok(!JSON.stringify(denyLog).includes("000000001"));

  await app.close();
});

test("writes audit artifact file", async () => {
  const artifactPath = resolve(process.cwd(), "artifacts/audit-sample.ndjson");
  if (existsSync(artifactPath)) {
    rmSync(artifactPath, { force: true });
  }

  const clock = createDeterministicClock();
  const app = Fastify();
  await app.register(auditLogPlugin, { clock });

  app.get("/health", async (request) => {
    request.audit.recordDecision("ALLOW", { reason: "ok" });
    return { ok: true };
  });

  await app.ready();

  const healthResponse = await app.inject({ method: "GET", url: "/health" });
  assert.equal(healthResponse.statusCode, 200);
  await app.close();
  await new Promise((resolve) => setTimeout(resolve, 25));

  assert.equal(existsSync(artifactPath), true);

  const contents = readFileSync(artifactPath, "utf-8").trim();
  assert.notEqual(contents.length, 0);
  const [line] = contents.split("\n");
  const payload = JSON.parse(line) as Line;
  assert.equal(payload.route, "/health");
  assert.equal(payload.decision, "ALLOW");
});
