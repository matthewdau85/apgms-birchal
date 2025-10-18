import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { buildApp } from "../src/app.js";
import { buildOpenApiDocument } from "../src/openapi.js";
import { resetStore } from "../src/data/store.js";
import { clearIdempotencyCache } from "../src/utils/idempotency.js";

async function setupApp(t: TestContext) {
  resetStore();
  clearIdempotencyCache();
  const app = await buildApp({ logger: false });
  await app.ready();
  t.after(async () => {
    await app.close();
  });
  return app;
}

test("GET /dashboard returns summary", async (t) => {
  const app = await setupApp(t);

  const response = await app.inject({ method: "GET", url: "/dashboard" });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.ok(body.summary.totalOrgs >= 1);
  assert.ok(Array.isArray(body.recentActivity.bankLines));
});

test("GET /bank-lines rejects invalid query", async (t) => {
  const app = await setupApp(t);

  const response = await app.inject({ method: "GET", url: "/bank-lines?take=abc" });
  assert.equal(response.statusCode, 400);
});

test("POST /bank-lines enforces idempotency and creates record", async (t) => {
  const app = await setupApp(t);

  const payload = {
    orgId: "org_1",
    date: new Date().toISOString(),
    amount: 1000,
    payee: "Test Vendor",
    description: "Test payment",
  };

  const first = await app.inject({
    method: "POST",
    url: "/bank-lines",
    headers: { "idempotency-key": "bank-lines-test" },
    payload,
  });
  assert.equal(first.statusCode, 201);
  const created = first.json();
  assert.equal(created.payee, payload.payee);

  const second = await app.inject({
    method: "POST",
    url: "/bank-lines",
    headers: { "idempotency-key": "bank-lines-test" },
    payload,
  });
  assert.equal(second.statusCode, 201);
  const replayed = second.json();
  assert.equal(replayed.id, created.id);
});

test("POST /bank-lines without idempotency key fails", async (t) => {
  const app = await setupApp(t);

  const response = await app.inject({
    method: "POST",
    url: "/bank-lines",
    payload: {
      orgId: "org_1",
      date: new Date().toISOString(),
      amount: 1000,
      payee: "Test Vendor",
      description: "Test payment",
    },
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error, "missing_idempotency_key");
});

test("GET /audit/rpt/:id returns report when data exists", async (t) => {
  const app = await setupApp(t);

  const response = await app.inject({ method: "GET", url: "/audit/rpt/org_1" });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.orgId, "org_1");
  assert.ok(body.totals.transactions >= 1);
});

test("GET /audit/rpt/:id returns 404 for unknown org", async (t) => {
  const app = await setupApp(t);

  const response = await app.inject({ method: "GET", url: "/audit/rpt/unknown" });
  assert.equal(response.statusCode, 404);
});

test("POST /allocations/preview validates payload", async (t) => {
  const app = await setupApp(t);

  const preview = await app.inject({
    method: "POST",
    url: "/allocations/preview",
    headers: { "idempotency-key": "alloc-preview" },
    payload: {
      orgId: "org_1",
      lines: [
        { lineId: "line_1", amount: 1500 },
        { lineId: "line_2", amount: 2000 },
      ],
    },
  });
  assert.equal(preview.statusCode, 200);
  const body = preview.json();
  assert.equal(body.results.length, 2);
  assert.equal(body.results[0].allocations.length, 3);
});

test("POST /allocations/preview rejects invalid payload", async (t) => {
  const app = await setupApp(t);

  const response = await app.inject({
    method: "POST",
    url: "/allocations/preview",
    headers: { "idempotency-key": "alloc-bad" },
    payload: { orgId: "" },
  });
  assert.equal(response.statusCode, 400);
});

test("POST /allocations/apply reuses idempotent responses", async (t) => {
  const app = await setupApp(t);

  const payload = {
    orgId: "org_1",
    lines: [{ lineId: "line_3", amount: 5000 }],
  };

  const first = await app.inject({
    method: "POST",
    url: "/allocations/apply",
    headers: { "idempotency-key": "apply" },
    payload,
  });
  assert.equal(first.statusCode, 200);
  const firstBody = first.json();
  assert.equal(firstBody.committed, true);

  const second = await app.inject({
    method: "POST",
    url: "/allocations/apply",
    headers: { "idempotency-key": "apply" },
    payload,
  });
  assert.equal(second.statusCode, 200);
  const secondBody = second.json();
  assert.deepEqual(secondBody, firstBody);
});

test("GET /policies returns list", async (t) => {
  const app = await setupApp(t);

  const response = await app.inject({ method: "GET", url: "/policies" });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.ok(body.items.length >= 1);
});

test("POST /policies enforces validation", async (t) => {
  const app = await setupApp(t);

  const invalid = await app.inject({
    method: "POST",
    url: "/policies",
    headers: { "idempotency-key": "policy-invalid" },
    payload: { name: "" },
  });
  assert.equal(invalid.statusCode, 400);

  const payload = {
    name: "Expense policy",
    description: "Controls how expenses are approved",
    rules: ["Managers approve up to $5k"],
  };

  const created = await app.inject({
    method: "POST",
    url: "/policies",
    headers: { "idempotency-key": "policy-create" },
    payload,
  });
  assert.equal(created.statusCode, 201);
  const policy = created.json();
  assert.equal(policy.name, payload.name);

  const replayed = await app.inject({
    method: "POST",
    url: "/policies",
    headers: { "idempotency-key": "policy-create" },
    payload,
  });
  assert.equal(replayed.statusCode, 201);
  assert.equal(replayed.json().id, policy.id);
});

test("OpenAPI document builds", () => {
  const document = buildOpenApiDocument();
  assert.equal(document.openapi, "3.1.0");
  assert.ok(document.paths["/dashboard"]);
  assert.ok(document.components.schemas.Policy);
});
