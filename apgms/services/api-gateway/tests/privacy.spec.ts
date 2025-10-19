import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerPrivacyRoutes } from "../src/routes/privacy.js";

type MockPrisma = {
  org: {
    findUnique: (args: any) => Promise<any>;
    updateMany?: (args: any) => Promise<any>;
  };
  user: {
    findMany: (args: any) => Promise<any>;
    updateMany?: (args: any) => Promise<any>;
  };
  bankLine: {
    findMany: (args: any) => Promise<any>;
    updateMany?: (args: any) => Promise<any>;
  };
  auditBlob?: {
    create: (args: any) => Promise<any>;
  };
};

function buildApp(prisma: MockPrisma) {
  const app = Fastify();

  app.decorateRequest("user", null);
  app.addHook("preHandler", (request, _reply, done) => {
    const header = request.headers["x-user"];
    if (typeof header === "string") {
      try {
        request.user = JSON.parse(header);
      } catch (err) {
        request.log.error({ err }, "failed to parse x-user header");
      }
    }
    done();
  });

  registerPrivacyRoutes(app, { prisma } as any);

  return app;
}

const basePrisma: MockPrisma = {
  org: {
    async findUnique({ where }: any) {
      if (where.id === "org-1") {
        return { id: "org-1", name: "Org One", createdAt: new Date("2024-01-01T00:00:00Z") };
      }
      return null;
    },
    async updateMany() {
      return { count: 1 };
    },
  },
  user: {
    async findMany({ where }: any) {
      if (where.orgId === "org-1") {
        return [
          { id: "user-1", email: "alice@example.com", createdAt: new Date("2024-01-02T00:00:00Z") },
        ];
      }
      return [];
    },
    async updateMany() {
      return { count: 1 };
    },
  },
  bankLine: {
    async findMany({ where }: any) {
      if (where.orgId === "org-1") {
        return [
          {
            id: "line-1",
            date: new Date("2024-02-01T00:00:00Z"),
            amount: "100.00",
            payee: "Vendor",
            desc: "Invoice",
            createdAt: new Date("2024-02-02T00:00:00Z"),
          },
        ];
      }
      return [];
    },
    async updateMany() {
      return { count: 1 };
    },
  },
  auditBlob: {
    async create() {
      return { id: "audit-1" };
    },
  },
};

test("non-admin cannot access privacy endpoints", async () => {
  const app = buildApp(basePrisma);

  const response = await app.inject({
    method: "GET",
    url: "/privacy/export?orgId=org-1",
    headers: {
      "x-user": JSON.stringify({ orgId: "org-1", roles: ["member"] }),
    },
  });

  assert.equal(response.statusCode, 403);
  await app.close();
});

test("admin cannot operate across org boundaries", async () => {
  const app = buildApp(basePrisma);

  const response = await app.inject({
    method: "GET",
    url: "/privacy/export?orgId=org-2",
    headers: {
      "x-user": JSON.stringify({ orgId: "org-1", roles: ["admin"] }),
    },
  });

  assert.equal(response.statusCode, 403);
  await app.close();
});

test("export bundles expected privacy data", async () => {
  const app = buildApp(basePrisma);

  const response = await app.inject({
    method: "GET",
    url: "/privacy/export",
    headers: {
      "x-user": JSON.stringify({ orgId: "org-1", roles: ["admin"], id: "user-1" }),
    },
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();

  assert.deepEqual(body.org, {
    id: "org-1",
    name: "Org One",
    createdAt: "2024-01-01T00:00:00.000Z",
  });
  assert.deepEqual(body.users, [
    {
      id: "user-1",
      email: "alice@example.com",
      createdAt: "2024-01-02T00:00:00.000Z",
    },
  ]);
  assert.deepEqual(body.bankLines, [
    {
      id: "line-1",
      date: "2024-02-01T00:00:00.000Z",
      amount: "100.00",
      payee: "Vendor",
      desc: "Invoice",
      createdAt: "2024-02-02T00:00:00.000Z",
    },
  ]);
  assert.deepEqual(body.policies, []);
  assert.deepEqual(body.gates, []);
  assert.deepEqual(body.ledger, []);
  assert.deepEqual(body.reports, []);

  await app.close();
});
