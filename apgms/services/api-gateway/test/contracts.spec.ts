import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prismaMock } from "./setup";
import { buildApp } from "../src/index";
import { TEST_ORG_ID, createJwt, fakeDecimal } from "./utils";

describe("contracts", () => {
  it("returns bank lines matching the public contract", async () => {
    const app = await buildApp();
    const token = await createJwt(TEST_ORG_ID);
    prismaMock.bankLine.findMany.mockResolvedValue([
      {
        id: "clbanklinevalid123456789012",
        orgId: TEST_ORG_ID,
        date: new Date("2024-01-01T00:00:00Z"),
        amount: fakeDecimal(2500),
        payee: "Vendor",
        desc: "Invoice",
        createdAt: new Date("2024-01-02T00:00:00Z"),
      },
    ]);

    const response = await app.inject({
      method: "GET",
      url: "/bank-lines",
      query: { orgId: TEST_ORG_ID },
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    assert.strictEqual(response.statusCode, 200);
    const payload = response.json();
    assert.strictEqual(payload.bankLines.length, 1);
    assert.deepStrictEqual(payload.bankLines[0], {
      id: "clbanklinevalid123456789012",
      orgId: TEST_ORG_ID,
      date: "2024-01-01T00:00:00.000Z",
      amountCents: 2500,
      payee: "Vendor",
      description: "Invoice",
      createdAt: "2024-01-02T00:00:00.000Z",
    });
    assert.strictEqual(payload.nextCursor, null);
    await app.close();
  });

  it("fails fast when bank line payload violates the schema", async () => {
    const app = await buildApp();
    const token = await createJwt(TEST_ORG_ID);
    prismaMock.bankLine.findMany.mockResolvedValue([
      {
        id: "clbanklinebad1234567890123",
        orgId: TEST_ORG_ID,
        date: new Date(),
        amount: fakeDecimal(10),
        payee: "Vendor",
        desc: null,
        createdAt: new Date(),
      } as any,
    ]);

    const response = await app.inject({
      method: "GET",
      url: "/bank-lines",
      query: { orgId: TEST_ORG_ID },
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    assert.ok(response.statusCode >= 500);
    await app.close();
  });
});
