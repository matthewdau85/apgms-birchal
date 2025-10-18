import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app";
import { prisma } from "@apgms/shared";
import { AllocationStatus } from "../src/lib/constants";
import { replace } from "./helpers";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/test";

test("GET /designated-accounts summarises accounts with confirmed allocation totals", async () => {
  const createdAt = new Date("2024-01-01T00:00:00.000Z");
  const updatedAt = new Date("2024-01-02T00:00:00.000Z");

  const restoreFindMany = replace(prisma.designatedAccount, "findMany", async () => [
    {
      id: "acc_1",
      orgId: "org_1",
      name: "Trust Account",
      bsb: "123-456",
      accountNumber: "12345678",
      balance: "1000.00",
      createdAt,
      updatedAt,
      allocations: [
        {
          id: "alloc_1",
          orgId: "org_1",
          amount: "250.00",
          status: AllocationStatus.CONFIRMED,
          notes: null,
          bankLineId: null,
          designatedAccountId: "acc_1",
          createdAt,
          updatedAt,
        },
        {
          id: "alloc_2",
          orgId: "org_1",
          amount: "100.00",
          status: AllocationStatus.PENDING,
          notes: null,
          bankLineId: null,
          designatedAccountId: "acc_1",
          createdAt,
          updatedAt,
        },
      ],
    },
  ] as any);

  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/designated-accounts?orgId=org_1",
    });

    assert.equal(response.statusCode, 200);
    assert.deepStrictEqual(response.json(), {
      items: [
        {
          id: "acc_1",
          orgId: "org_1",
          name: "Trust Account",
          bsb: "123-456",
          accountNumber: "12345678",
          balance: "1000.00",
          allocatedAmount: "250.00",
          allocationCount: 2,
          createdAt: "2024-01-01T00:00:00.000Z",
          updatedAt: "2024-01-02T00:00:00.000Z",
        },
      ],
    });
  } finally {
    await app.close();
    restoreFindMany();
  }
});

test("GET /designated-accounts requires an organisation id", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/designated-accounts" });
    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error, "validation_error");
  } finally {
    await app.close();
  }
});
