import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../../server/app";
import type { PrismaService } from "../../server/services";

const ORG_ID = "org-1";

const bankLineRecords = [
  {
    id: "line-1",
    orgId: ORG_ID,
    date: new Date("2024-02-01T10:00:00Z"),
    amount: 1500,
    payee: "Supplier A",
    desc: "Invoice 1001",
  },
  {
    id: "line-2",
    orgId: ORG_ID,
    date: new Date("2024-01-15T09:30:00Z"),
    amount: 2750,
    payee: "Utilities B",
    desc: "Power bill",
  },
];

const policyRecords = [
  {
    id: "policy-1",
    orgId: ORG_ID,
    name: "Cyber insurance",
    status: "ACTIVE",
    premium: 1200,
    effectiveDate: new Date("2024-01-01T00:00:00Z"),
  },
  {
    id: "policy-2",
    orgId: ORG_ID,
    name: "Management liability",
    status: "PENDING",
    premium: 800,
    effectiveDate: new Date("2024-03-01T00:00:00Z"),
  },
];

const auditRecords = [
  {
    id: "audit-1",
    orgId: ORG_ID,
    actor: "jane@example.com",
    action: "Updated policy",
    createdAt: new Date("2024-03-02T12:00:00Z"),
    details: { policyId: "policy-2" },
  },
  {
    id: "audit-2",
    orgId: ORG_ID,
    actor: "john@example.com",
    action: "Created bank line",
    createdAt: new Date("2024-02-01T10:05:00Z"),
    details: { bankLineId: "line-1" },
  },
];

const allocationRecords = [
  {
    id: "allocation-1",
    orgId: ORG_ID,
    portfolio: "Cash reserve",
    amount: 5000,
    currency: "AUD",
    updatedAt: new Date("2024-03-04T09:00:00Z"),
  },
  {
    id: "allocation-2",
    orgId: ORG_ID,
    portfolio: "Growth",
    amount: 3250,
    currency: "AUD",
    updatedAt: new Date("2024-02-10T08:30:00Z"),
  },
];

const prismaStub: PrismaService = {
  org: {
    findUnique: async ({ where }) =>
      where.id === ORG_ID ? { id: ORG_ID, name: "Birchal Holdings" } : null,
  },
  user: {
    count: async () => 5,
  },
  bankLine: {
    findMany: async ({ where, orderBy }) => {
      const filtered = bankLineRecords.filter((line) => line.orgId === where.orgId);
      if (orderBy?.date === "desc") {
        filtered.sort((a, b) => b.date.getTime() - a.date.getTime());
      } else if (orderBy?.date === "asc") {
        filtered.sort((a, b) => a.date.getTime() - b.date.getTime());
      }
      return filtered;
    },
    aggregate: async ({ where }) => ({
      _sum: {
        amount: bankLineRecords
          .filter((line) => line.orgId === where.orgId)
          .reduce((total, line) => total + Number(line.amount), 0),
      },
    }),
  },
  policy: {
    findMany: async ({ where, orderBy }) => {
      const filtered = policyRecords.filter((policy) => policy.orgId === where.orgId);
      if (orderBy?.effectiveDate === "desc") {
        filtered.sort((a, b) => b.effectiveDate.getTime() - a.effectiveDate.getTime());
      } else if (orderBy?.effectiveDate === "asc") {
        filtered.sort((a, b) => a.effectiveDate.getTime() - b.effectiveDate.getTime());
      }
      return filtered;
    },
    count: async ({ where }) => policyRecords.filter((policy) => policy.orgId === where.orgId).length,
  },
  auditLog: {
    findMany: async ({ where, orderBy, take }) => {
      const filtered = auditRecords
        .filter((entry) => entry.orgId === where.orgId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      if (orderBy?.createdAt === "asc") {
        filtered.reverse();
      }
      return typeof take === "number" ? filtered.slice(0, take) : filtered;
    },
    findFirst: async ({ where }) => {
      const sorted = auditRecords
        .filter((entry) => entry.orgId === where.orgId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return sorted[0] ?? null;
    },
  },
  allocation: {
    findMany: async ({ where, orderBy }) => {
      const filtered = allocationRecords.filter((allocation) => allocation.orgId === where.orgId);
      if (orderBy?.updatedAt === "desc") {
        filtered.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      } else if (orderBy?.updatedAt === "asc") {
        filtered.sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
      }
      return filtered;
    },
    aggregate: async ({ where }) => ({
      _sum: {
        amount: allocationRecords
          .filter((allocation) => allocation.orgId === where.orgId)
          .reduce((total, allocation) => total + Number(allocation.amount), 0),
      },
    }),
  },
};

test("GET /dashboard returns aggregated summary", async (t) => {
  const app = buildApp({ prisma: prismaStub });
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/dashboard",
    query: { orgId: ORG_ID },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    org: { id: ORG_ID, name: "Birchal Holdings" },
    metrics: {
      userCount: 5,
      bankLineTotal: 4250,
      policyCount: 2,
      allocationTotal: 8250,
    },
    latestAudit: {
      id: "audit-1",
      actor: "jane@example.com",
      action: "Updated policy",
      createdAt: auditRecords[0].createdAt.toISOString(),
    },
  });
});

test("GET /bank-lines returns the org bank lines", async (t) => {
  const app = buildApp({ prisma: prismaStub });
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/bank-lines",
    query: { orgId: ORG_ID },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.items.length, 2);
  assert.equal(payload.items[0].id, "line-1");
  assert.equal(payload.items[1].id, "line-2");
});

test("GET /policies returns the org policies", async (t) => {
  const app = buildApp({ prisma: prismaStub });
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/policies",
    query: { orgId: ORG_ID },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.items.length, 2);
  assert.equal(payload.items[0].id, "policy-2");
  assert.equal(payload.items[1].id, "policy-1");
});

test("GET /audit returns the audit log", async (t) => {
  const app = buildApp({ prisma: prismaStub });
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/audit",
    query: { orgId: ORG_ID },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.items.length, 2);
  assert.equal(payload.items[0].id, "audit-1");
});

test("GET /allocations returns the portfolio allocations", async (t) => {
  const app = buildApp({ prisma: prismaStub });
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({
    method: "GET",
    url: "/allocations",
    query: { orgId: ORG_ID },
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.items.length, 2);
  assert.equal(payload.items[0].id, "allocation-1");
  assert.equal(payload.items[1].id, "allocation-2");
});

test("Routes enforce the orgId query parameter", async (t) => {
  const app = buildApp({ prisma: prismaStub });
  t.after(async () => {
    await app.close();
  });

  const response = await app.inject({ method: "GET", url: "/bank-lines" });
  assert.equal(response.statusCode, 400);
});
