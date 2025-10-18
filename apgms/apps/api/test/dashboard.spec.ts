import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app";
import { prisma } from "@apgms/shared";
import { replace } from "./helpers";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/test";

test("GET /dashboard returns the dashboard summary for an organisation", async () => {
  const restoreFindUnique = replace(prisma.org, "findUnique", async () => ({
    id: "org_1",
    name: "Acme Ltd",
  }) as any);
  const restoreAggregate = replace(prisma.bankLine, "aggregate", async () => ({
    _count: { _all: 3 },
    _sum: { amount: "120.50" },
  }) as any);
  const restoreAllocationCount = replace(prisma.allocation, "count", async () => 2);
  const restoreAccountCount = replace(prisma.designatedAccount, "count", async () => 4);
  const restoreAuditFindMany = replace(prisma.auditEvent, "findMany", async () => [
    {
      id: "audit_1",
      orgId: "org_1",
      allocationId: "alloc_1",
      actor: "user@acme.com",
      action: "ALLOCATION_CONFIRMED",
      details: { source: "system" },
      createdAt: new Date("2024-02-01T00:00:00.000Z"),
    },
  ] as any);

  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/dashboard?orgId=org_1",
    });

    assert.equal(response.statusCode, 200);
    assert.deepStrictEqual(response.json(), {
      org: { id: "org_1", name: "Acme Ltd" },
      totals: {
        bankLineCount: 3,
        bankLineAmount: "120.50",
        pendingAllocations: 2,
        designatedAccountCount: 4,
      },
      recentActivity: [
        {
          id: "audit_1",
          actor: "user@acme.com",
          action: "ALLOCATION_CONFIRMED",
          allocationId: "alloc_1",
          details: { source: "system" },
          createdAt: "2024-02-01T00:00:00.000Z",
        },
      ],
    });
  } finally {
    await app.close();
    restoreFindUnique();
    restoreAggregate();
    restoreAllocationCount();
    restoreAccountCount();
    restoreAuditFindMany();
  }
});

test("GET /dashboard returns 404 when the organisation cannot be found", async () => {
  const restoreFindUnique = replace(prisma.org, "findUnique", async () => null);
  const app = buildApp();

  try {
    const response = await app.inject({
      method: "GET",
      url: "/dashboard?orgId=missing",
    });

    assert.equal(response.statusCode, 404);
    assert.deepStrictEqual(response.json(), { error: "org_not_found" });
  } finally {
    await app.close();
    restoreFindUnique();
  }
});

test("GET /dashboard rejects invalid query parameters", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/dashboard",
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error, "validation_error");
  } finally {
    await app.close();
  }
});
