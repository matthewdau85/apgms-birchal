process.env.NODE_ENV = "test";

import { afterEach, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import type { buildApp as buildAppType } from "../src/index.js";

const encodeToken = (payload: Record<string, unknown>) =>
  Buffer.from(JSON.stringify(payload), "utf8").toString("base64");

let buildApp: typeof buildAppType;

describe("auth and org scope guards", () => {
  let app: FastifyInstance;
  let bankLineCreateCalls: Array<unknown>;
  let bankLineFindArgs: Array<unknown>;

  const orgId = "org-123";

  before(async () => {
    ({ buildApp } = await import("../src/index.js"));
  });

  beforeEach(async () => {
    bankLineCreateCalls = [];
    bankLineFindArgs = [];

    const prismaMock = {
      user: {
        findMany: async () => [
          {
            email: "user@example.com",
            orgId,
            createdAt: new Date("2024-01-01T00:00:00.000Z"),
          },
        ],
      },
      bankLine: {
        findMany: async (args: unknown) => {
          bankLineFindArgs.push(args);
          return [
            {
              id: "line-1",
              orgId,
              date: new Date("2024-01-01T00:00:00.000Z"),
              amount: 100,
              payee: "Vendor",
              desc: "Payment",
            },
          ];
        },
        create: async (args: unknown) => {
          bankLineCreateCalls.push(args);
          return {
            id: "line-2",
            ...(args as { data: Record<string, unknown> }).data,
          };
        },
      },
    };

    app = await buildApp({ prismaClient: prismaMock as any });
  });

  afterEach(async () => {
    await app.close();
  });

  it("returns 401 when no authorization token is provided", async () => {
    const response = await app.inject({ method: "GET", url: "/users" });
    assert.equal(response.statusCode, 401);
  });

  it("allows access with a valid token", async () => {
    const token = encodeToken({
      sub: "user-1",
      email: "user@example.com",
      orgId,
      roles: ["admin"],
    });

    const response = await app.inject({
      method: "GET",
      url: "/bank-lines",
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body) as { lines: Array<Record<string, unknown>> };
    assert.ok(Array.isArray(body.lines));
    assert.equal(body.lines[0]?.orgId, orgId);

    const firstArgs = bankLineFindArgs[0] as { where?: { orgId?: string } } | undefined;
    assert.equal(firstArgs?.where?.orgId, orgId);
  });

  it("rejects cross-tenant modifications", async () => {
    const token = encodeToken({
      sub: "user-1",
      email: "user@example.com",
      orgId,
    });

    const response = await app.inject({
      method: "POST",
      url: "/bank-lines",
      headers: { authorization: `Bearer ${token}` },
      payload: {
        orgId: "org-999",
        date: "2024-01-02",
        amount: 250,
        payee: "Another Vendor",
        desc: "Cross-tenant attempt",
      },
    });

    assert.equal(response.statusCode, 403);
    assert.equal(bankLineCreateCalls.length, 0);
  });
});
