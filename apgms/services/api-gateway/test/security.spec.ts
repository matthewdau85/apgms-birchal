import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prismaMock } from "./setup";
import { buildApp } from "../src/index";
import { TEST_ORG_ID, createJwt, fakeDecimal } from "./utils";

describe("security plugin", () => {
  it("allows preflight requests for allowlisted origins", async () => {
    process.env.CORS_ALLOWLIST = "https://allowed.example";
    const app = await buildApp();
    const response = await app.inject({
      method: "OPTIONS",
      url: "/users",
      headers: {
        origin: "https://allowed.example",
        "access-control-request-method": "GET",
      },
    });
    assert.strictEqual(response.statusCode, 204);
    await app.close();
  });

  it("blocks preflight requests for non-allowlisted origins", async () => {
    process.env.CORS_ALLOWLIST = "https://allowed.example";
    const app = await buildApp();
    const response = await app.inject({
      method: "OPTIONS",
      url: "/users",
      headers: {
        origin: "https://denied.example",
        "access-control-request-method": "GET",
      },
    });
    assert.strictEqual(response.statusCode, 403);
    await app.close();
  });

  it("applies rate limiting per IP", async () => {
    process.env.CORS_ALLOWLIST = "https://allowed.example";
    const app = await buildApp();
    prismaMock.user.findMany.mockResolvedValue([]);
    const token = await createJwt(TEST_ORG_ID);

    for (let i = 0; i < 100; i += 1) {
      const okResponse = await app.inject({
        method: "GET",
        url: "/users",
        query: { orgId: TEST_ORG_ID },
        headers: { authorization: `Bearer ${token}`, "x-real-ip": "203.0.113.10" },
      });
      assert.strictEqual(okResponse.statusCode, 200);
    }

    const limitedResponse = await app.inject({
      method: "GET",
      url: "/users",
      query: { orgId: TEST_ORG_ID },
      headers: { authorization: `Bearer ${token}`, "x-real-ip": "203.0.113.10" },
    });
    assert.strictEqual(limitedResponse.statusCode, 429);
    await app.close();
  });

  it("rejects payloads exceeding the body limit", async () => {
    process.env.CORS_ALLOWLIST = "https://allowed.example";
    const app = await buildApp();
    prismaMock.bankLine.create.mockResolvedValue({
      id: "line_large",
      orgId: TEST_ORG_ID,
      date: new Date(),
      amount: fakeDecimal(1000),
      payee: "Vendor",
      desc: "Invoice",
      createdAt: new Date(),
    });
    const token = await createJwt(TEST_ORG_ID);
    const response = await app.inject({
      method: "POST",
      url: "/bank-lines",
      headers: {
        authorization: `Bearer ${token}`,
        "idempotency-key": "oversize-test",
        "content-type": "application/json",
      },
      payload: {
        orgId: TEST_ORG_ID,
        date: new Date().toISOString(),
        amountCents: 1000,
        payee: "Vendor",
        description: "x".repeat(600 * 1024),
      },
    });
    assert.strictEqual(response.statusCode, 413);
    await app.close();
  });
});
