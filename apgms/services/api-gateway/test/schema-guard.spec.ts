import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import Fastify from "fastify";
import registerSchemaGuard from "../src/plugins/schema-guard.js";

const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
});

test("development rejects malformed /bank-lines response", async (t) => {
  process.env.NODE_ENV = "development";
  const app = Fastify({ logger: false });
  registerSchemaGuard(app);
  app.get("/bank-lines", async () => ({ lines: [{}] }));

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/bank-lines",
    headers: { "x-correlation-id": "corr-dev" },
  });

  assert.equal(response.statusCode, 500);
  const payload = response.json();
  assert.equal(payload.error, "response_schema_validation_failed");
  assert.equal(payload.correlationId, "corr-dev");
});

test("production logs schema failures but returns original payload", async (t) => {
  process.env.NODE_ENV = "production";

  const logs: Array<Record<string, unknown>> = [];
  const app = Fastify({
    logger: {
      level: "error",
      stream: {
        write(message: string) {
          try {
            logs.push(JSON.parse(message));
          } catch {
            // ignore
          }
        },
      },
    },
  });

  registerSchemaGuard(app);
  app.get("/bank-lines", async () => ({ lines: [{}] }));

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/bank-lines",
    headers: { "x-correlation-id": "corr-prod" },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { lines: [{}] });

  const errorLog = logs.find((entry) => entry.msg === "response schema validation failed");
  assert.ok(errorLog, "expected schema guard to log validation failure");
  assert.equal(errorLog?.correlationId, "corr-prod");
});
