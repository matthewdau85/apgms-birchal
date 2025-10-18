import test from "node:test";
import assert from "node:assert/strict";

import { buildApp } from "../src/app";

test("GET /users enforces reply schema", async (t) => {
  const stubbedPrisma = {
    user: {
      findMany: async () => [
        {
          orgId: "org_123",
          createdAt: new Date("2023-01-01T00:00:00.000Z"),
        },
      ],
    },
    bankLine: {
      findMany: async () => [],
      create: async () => ({
        id: "line_123",
        orgId: "org_123",
        date: new Date("2023-01-01T00:00:00.000Z"),
        amount: { toString: () => "0" },
        payee: "",
        desc: "",
        createdAt: new Date("2023-01-01T00:00:00.000Z"),
      }),
    },
  } as any;

  const app = await buildApp({ logger: false }, { prisma: stubbedPrisma });
  await app.ready();

  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({ method: "GET", url: "/users" });

  assert.equal(response.statusCode, 500);
});
