import assert from "node:assert/strict";
import { createApp } from "../src/app.ts";

const decimal = (value: number | string) => ({
  toString: () => value.toString(),
});

process.env.NODE_ENV = "test";

const prismaStub = {
  user: {
    findMany: async () => [],
  },
  bankLine: {
    findMany: async () => [],
    create: async () => {
      throw new Error("create not mocked");
    },
  },
};

const app = await createApp({ prisma: prismaStub });

await app.ready();

const originalFindMany = prismaStub.bankLine.findMany;
const originalCreate = prismaStub.bankLine.create;

try {
  prismaStub.bankLine.findMany = async () => [
    {
      id: "bank_line_invalid",
      orgId: "org-invalid",
      date: new Date("2024-01-01T00:00:00.000Z"),
      amount: decimal("12.34"),
      payee: "Bad Amount",
      desc: "Invalid amount for contract",
      createdAt: new Date("2024-01-01T00:00:00.000Z"),
    },
  ];

  const invalidResponse = await app.inject({ method: "GET", url: "/bank-lines" });
  assert.equal(
    invalidResponse.statusCode,
    500,
    `Expected 500 when response validation fails, received ${invalidResponse.statusCode}`,
  );

  prismaStub.bankLine.findMany = async () => [
    {
      id: "bank_line_valid",
      orgId: "org-valid",
      date: new Date("2024-01-02T00:00:00.000Z"),
      amount: decimal(1234),
      payee: "ACME",
      desc: "Invoice",
      createdAt: new Date("2024-01-03T00:00:00.000Z"),
    },
  ];

  const response = await app.inject({ method: "GET", url: "/bank-lines" });
  assert.equal(response.statusCode, 200, response.payload);

  const payload = response.json();
  assert.ok(Array.isArray(payload.lines));
  assert.equal(payload.lines[0].amountCents, 1234);
  assert.equal(typeof payload.lines[0].amountCents, "number");

  prismaStub.bankLine.create = async ({ data }) => ({
    id: "bank_line_new",
    orgId: data.orgId,
    date: data.date,
    amount: decimal(data.amount),
    payee: data.payee,
    desc: data.desc,
    createdAt: new Date("2024-01-04T00:00:00.000Z"),
  });

  const createResponse = await app.inject({
    method: "POST",
    url: "/bank-lines",
    payload: {
      orgId: "org-valid",
      date: "2024-01-05T00:00:00.000Z",
      amountCents: 9876,
      payee: "Widgets Co",
      desc: "Payment",
    },
  });

  assert.equal(createResponse.statusCode, 201, createResponse.payload);
  const created = createResponse.json();
  assert.equal(created.amountCents, 9876);

  const badCreate = await app.inject({
    method: "POST",
    url: "/bank-lines",
    payload: {
      orgId: "org-valid",
      date: "not-a-date",
      amountCents: -10,
      payee: "",
      desc: "",
    },
  });

  assert.equal(badCreate.statusCode, 400, badCreate.payload);
} finally {
  prismaStub.bankLine.findMany = originalFindMany;
  prismaStub.bankLine.create = originalCreate;
  await app.close();
}
