import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app";
import { prisma } from "@apgms/shared";
import { AllocationStatus } from "../src/lib/constants";
import { replace } from "./helpers";

process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/test";

test("GET /bank-lines returns the latest bank lines with allocation details", async () => {
  const restoreFindMany = replace(prisma.bankLine, "findMany", async () => [
    {
      id: "line_1",
      orgId: "org_1",
      date: new Date("2024-01-05T00:00:00.000Z"),
      amount: "150.75",
      payee: "Contoso Pty Ltd",
      desc: "Invoice 42",
      createdAt: new Date("2024-01-06T00:00:00.000Z"),
      allocations: [
        {
          id: "alloc_1",
          amount: "150.75",
          status: AllocationStatus.CONFIRMED,
          notes: "Settled",
          designatedAccountId: "acc_1",
          bankLineId: "line_1",
          createdAt: new Date("2024-01-06T00:00:00.000Z"),
          updatedAt: new Date("2024-01-07T00:00:00.000Z"),
        },
      ],
    },
  ] as any);

  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/bank-lines?orgId=org_1&limit=10",
    });

    assert.equal(response.statusCode, 200);
    assert.deepStrictEqual(response.json(), {
      items: [
        {
          id: "line_1",
          orgId: "org_1",
          date: "2024-01-05T00:00:00.000Z",
          amount: "150.75",
          payee: "Contoso Pty Ltd",
          description: "Invoice 42",
          createdAt: "2024-01-06T00:00:00.000Z",
          allocations: [
            {
              id: "alloc_1",
              amount: "150.75",
              status: "CONFIRMED",
              notes: "Settled",
              designatedAccountId: "acc_1",
              bankLineId: "line_1",
              createdAt: "2024-01-06T00:00:00.000Z",
              updatedAt: "2024-01-07T00:00:00.000Z",
            },
          ],
        },
      ],
    });
  } finally {
    await app.close();
    restoreFindMany();
  }
});

test("GET /bank-lines fails validation when the limit is out of range", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({
      method: "GET",
      url: "/bank-lines?orgId=org_1&limit=500",
    });

    assert.equal(response.statusCode, 400);
    assert.equal(response.json().error, "validation_error");
  } finally {
    await app.close();
  }
});
