import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import Fastify from "fastify";

import openapiPlugin from "../src/plugins/openapi";

describe("reports contract", () => {
  const app = Fastify({ logger: false });

  before(async () => {
    await app.register(openapiPlugin);
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  it("returns a validation error for missing orgId", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/reports/cashflow",
    });

    assert.equal(response.statusCode, 400);
    const body = response.json();
    assert.equal(body.error, "Bad Request");
    assert.equal(body.statusCode, 400);
    assert.ok(Array.isArray(body.issues));
    assert.ok(body.issues.some((issue: { path: unknown[] }) => issue.path[0] === "orgId"));
  });

  it("generates a zeroed cashflow report when no data is found", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/reports/cashflow",
      query: {
        orgId: "org_test",
      },
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.report.orgId, "org_test");
    assert.equal(body.report.currency, "AUD");
    assert.equal(body.report.linesAnalyzed, 0);
    assert.equal(body.report.totals.inflow, 0);
    assert.equal(body.report.totals.outflow, 0);
    assert.equal(body.report.totals.net, 0);
    assert.equal(body.report.period.from, null);
    assert.equal(body.report.period.to, null);
  });

  it("publishes the OpenAPI specification with the cashflow path", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/openapi.json",
    });

    assert.equal(response.statusCode, 200);
    const document = response.json();
    assert.equal(document.info.title, "APGMS API");
    assert.ok(document.paths["/api/v1/reports/cashflow"]);
    const operation = document.paths["/api/v1/reports/cashflow"].get;
    assert.ok(operation, "GET operation for /api/v1/reports/cashflow should exist");
    assert.ok(operation.responses["200"], "OpenAPI document should describe the success response");
  });
});
