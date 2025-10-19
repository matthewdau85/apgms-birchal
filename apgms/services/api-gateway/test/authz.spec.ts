import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prismaMock } from "./setup";
import { buildApp } from "../src/index";
import { TEST_ORG_ID, createJwt, fakeDecimal } from "./utils";

describe("authorization", () => {
  const routes = [
    { method: "GET", url: "/users", query: { orgId: TEST_ORG_ID } },
    { method: "GET", url: "/bank-lines", query: { orgId: TEST_ORG_ID } },
    {
      method: "POST",
      url: "/bank-lines",
      payload: {
        orgId: TEST_ORG_ID,
        date: new Date().toISOString(),
        amountCents: 1000,
        payee: "Vendor",
        description: "Invoice",
      },
      headers: { "idempotency-key": "key-123" },
    },
  ] as const;

  it("denies anonymous access", async () => {
    for (const route of routes) {
      const app = await buildApp();
      if (route.url === "/users") {
        prismaMock.user.findMany.mockResolvedValue([]);
      }
      if (route.url === "/bank-lines" && route.method === "GET") {
        prismaMock.bankLine.findMany.mockResolvedValue([]);
      }
      if (route.method === "POST") {
        prismaMock.bankLine.create.mockResolvedValue({
          id: "clbanklinetest00000000001",
          orgId: route.payload.orgId,
          date: new Date(route.payload.date),
          amount: fakeDecimal(route.payload.amountCents),
          payee: route.payload.payee,
          desc: route.payload.description,
          createdAt: new Date(),
        });
      }
      const response = await app.inject({
        method: route.method,
        url: route.url,
        query: (route as any).query,
        payload: (route as any).payload,
        headers: (route as any).headers,
      });
      assert.strictEqual(response.statusCode, 401);
      await app.close();
    }
  });

  it("blocks cross-tenant access", async () => {
    for (const route of routes) {
      const app = await buildApp();
      prismaMock.user.findMany.mockResolvedValue([]);
      prismaMock.bankLine.findMany.mockResolvedValue([]);
      prismaMock.bankLine.create.mockResolvedValue({
        id: "clbanklinetest00000000001",
        orgId: "ckorg1test00000000000099",
        date: new Date(),
        amount: fakeDecimal(1000),
        payee: "Vendor",
        desc: "Invoice",
        createdAt: new Date(),
      });
      const token = await createJwt(TEST_ORG_ID);
      const headers = {
        ...(route as any).headers,
        authorization: `Bearer ${token}`,
      } as Record<string, string>;

      const response = await app.inject({
        method: route.method,
        url: route.url,
        query: route.url === "/users" || route.url === "/bank-lines"
          ? { orgId: "ckorg1test00000000000099" }
          : undefined,
        payload:
          route.method === "POST"
            ? {
                ...(route as any).payload,
                orgId: "ckorg1test00000000000099",
              }
            : undefined,
        headers,
      });
      assert.strictEqual(response.statusCode, 403);
      await app.close();
    }
  });

  it("allows tenant access when scopes match", async () => {
    for (const route of routes) {
      const app = await buildApp();
    if (route.url === "/users") {
      prismaMock.user.findMany.mockResolvedValue([
        {
          id: "ckuser12345678901234567890",
          email: "user@example.com",
          orgId: route.query.orgId,
          createdAt: new Date(),
        },
      ]);
    }
    if (route.url === "/bank-lines" && route.method === "GET") {
      prismaMock.bankLine.findMany.mockResolvedValue([
        {
          id: "clbankline123456789012345678",
          orgId: route.query.orgId,
          date: new Date(),
          amount: fakeDecimal(1234),
          payee: "Vendor",
            desc: "Invoice",
            createdAt: new Date(),
          },
        ]);
      }
    if (route.method === "POST") {
      prismaMock.bankLine.create.mockResolvedValue({
        id: "clbanklinecreated1234567890",
        orgId: route.payload.orgId,
        date: new Date(route.payload.date),
        amount: fakeDecimal(route.payload.amountCents),
        payee: route.payload.payee,
          desc: route.payload.description,
          createdAt: new Date(),
        });
      }
      const token = await createJwt(TEST_ORG_ID);
      const headers = {
        ...(route as any).headers,
        authorization: `Bearer ${token}`,
      } as Record<string, string>;

      const response = await app.inject({
        method: route.method,
        url: route.url,
        query: (route as any).query,
        payload: (route as any).payload,
        headers,
      });
      assert.ok([200, 201, 202].includes(response.statusCode));
      await app.close();
    }
  });
});
