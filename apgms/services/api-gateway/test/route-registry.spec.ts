import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";

import { registerRoutes, ROUTE_WHITELIST } from "../src/routes/index.js";

function createPrismaMock() {
  return {
    user: {
      findMany: async () => [],
    },
    bankLine: {
      findMany: async () => [],
      create: async (data: unknown) => data,
    },
  };
}

test("registerRoutes mounts only whitelisted routes", async (t) => {
  const app = Fastify();
  t.after(() => app.close());

  const deps = { prisma: createPrismaMock() } as const;

  await registerRoutes(app, ROUTE_WHITELIST, deps);

  for (const entry of ROUTE_WHITELIST) {
    const [method, url] = entry.split(" ", 2) as [string, string];
    assert.equal(
      app.hasRoute({ method, url }),
      true,
      `Expected ${method} ${url} to be registered`,
    );
  }

  assert.equal(app.hasRoute({ method: "GET", url: "/not-allowed" }), false);
});

test("registerRoutes rejects routes outside whitelist", async () => {
  const app = Fastify();

  const deps = { prisma: createPrismaMock() } as const;

  await assert.rejects(
    registerRoutes(app, [...ROUTE_WHITELIST, "POST /evil"], deps),
    /not whitelisted/i,
  );

  await app.close();
});
