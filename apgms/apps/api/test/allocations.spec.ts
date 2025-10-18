import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app";
import { prisma } from "@apgms/shared";
import { AllocationStatus } from "../src/lib/constants";
import { replace } from "./helpers";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/test";

test("GET /allocations lists allocations with related resources", async () => {
  const createdAt = new Date("2024-03-01T00:00:00.000Z");
  const updatedAt = new Date("2024-03-02T00:00:00.000Z");

  const restoreFindMany = replace(prisma.allocation, "findMany", async () => [
    {
      id: "alloc_1",
      orgId: "org_1",
      amount: "89.90",
      status: AllocationStatus.PENDING,
      notes: "Waiting for approval",
      createdAt,
      updatedAt,
      bankLineId: "line_1",
      designatedAccountId: "acc_1",
      bankLine: {
        id: "line_1",
        orgId: "org_1",
        date: new Date("2024-02-28T00:00:00.000Z"),
        amount: "89.90",
        payee: "ATO",
        desc: "Tax payment",
        createdAt,
        allocations: [],
      },
      designatedAccount: {
        id: "acc_1",
        orgId: "org_1",
        name: "ATO Holding",
        bsb: "111-222",
        accountNumber: "987654",
        balance: "500.00",
        createdAt,
        updatedAt,
        allocations: [],
      },
    },
  ] as any);

  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/allocations?orgId=org_1&status=PENDING",
    });

    assert.equal(response.statusCode, 200);
    assert.deepStrictEqual(response.json(), {
      items: [
        {
          id: "alloc_1",
          orgId: "org_1",
          amount: "89.90",
          status: "PENDING",
          notes: "Waiting for approval",
          createdAt: "2024-03-01T00:00:00.000Z",
          updatedAt: "2024-03-02T00:00:00.000Z",
          bankLine: {
            id: "line_1",
            date: "2024-02-28T00:00:00.000Z",
            amount: "89.90",
            payee: "ATO",
            description: "Tax payment",
          },
          designatedAccount: {
            id: "acc_1",
            name: "ATO Holding",
            bsb: "111-222",
            accountNumber: "987654",
          },
        },
      ],
    });
  } finally {
    await app.close();
    restoreFindMany();
  }
});

test("GET /allocations validates the status filter", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/allocations?orgId=org_1&status=UNKNOWN",
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error, "validation_error");
  } finally {
    await app.close();
  }
});
