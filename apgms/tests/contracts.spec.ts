import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { FastifyInstance } from "fastify";
import { Decimal } from "@prisma/client/runtime/library";
import { z } from "zod";

import { buildApp, type BuildAppDependencies } from "../services/api-gateway/src/app.js";
import { replyValidate } from "../services/api-gateway/src/lib/reply.js";

const userRecords = [
  {
    email: "alpha@example.com",
    orgId: "clorg123456000000000000000",
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
  },
];

const bankLineRecords = [
  {
    id: "clline123456000000000000000",
    orgId: "clorg123456000000000000000",
    date: new Date("2024-02-01T00:00:00.000Z"),
    amount: new Decimal("123.45"),
    payee: "Acme Corp",
    desc: "Invoice 1",
    createdAt: new Date("2024-02-02T00:00:00.000Z"),
  },
  {
    id: "clline123456000000000000001",
    orgId: "clorg123456000000000000000",
    date: new Date("2024-01-15T00:00:00.000Z"),
    amount: new Decimal("5.00"),
    payee: "Beta LLC",
    desc: "Subscription",
    createdAt: new Date("2024-01-16T00:00:00.000Z"),
  },
];

const userFindManyCalls: unknown[] = [];
const bankLineFindManyCalls: unknown[] = [];
const bankLineCreateCalls: unknown[] = [];

const stubPrisma: BuildAppDependencies["prisma"] = {
  user: {
    findMany: async (args: unknown) => {
      userFindManyCalls.push(args);
      return userRecords;
    },
  },
  bankLine: {
    findMany: async (args: { take?: number }) => {
      bankLineFindManyCalls.push(args);
      const take = args.take ?? bankLineRecords.length;
      return bankLineRecords.slice(0, take);
    },
    create: async (args: any) => {
      bankLineCreateCalls.push(args);
      return {
        id: "clline123456000000000000999",
        orgId: args.data.orgId,
        date: args.data.date,
        amount: args.data.amount,
        payee: args.data.payee,
        desc: args.data.desc,
        createdAt: new Date("2024-03-01T00:00:00.000Z"),
      };
    },
  },
};

describe("replyValidate", () => {
  it("throws when payload violates schema", () => {
    const schema = z.object({ foo: z.string() });
    assert.throws(() => replyValidate(schema)({ foo: 1 } as any));
  });
});

describe("api gateway contracts", () => {
  let app: FastifyInstance;

  before(async () => {
    app = await buildApp({ prisma: stubPrisma });
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  it("returns users with iso dates", async () => {
    const response = await app.inject({ method: "GET", url: "/users" });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      users: userRecords.map((user) => ({
        email: user.email,
        orgId: user.orgId,
        createdAt: user.createdAt.toISOString(),
      })),
    });
    assert.equal(userFindManyCalls.length, 1);
  });

  it("paginates bank lines and exposes amount cents", async () => {
    const response = await app.inject({ method: "GET", url: "/bank-lines?take=1" });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), {
      lines: [
        {
          id: bankLineRecords[0].id,
          orgId: bankLineRecords[0].orgId,
          date: bankLineRecords[0].date.toISOString(),
          amountCents: Math.round(bankLineRecords[0].amount.toNumber() * 100),
          payee: bankLineRecords[0].payee,
          desc: bankLineRecords[0].desc,
          createdAt: bankLineRecords[0].createdAt.toISOString(),
        },
      ],
      nextCursor: bankLineRecords[1].id,
    });

    assert.equal(bankLineFindManyCalls.length, 1);
    assert.equal((bankLineFindManyCalls[0] as any).take, 2);
  });

  it("creates bank lines with validated payload", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/bank-lines",
      payload: {
        orgId: "clorg123456000000000000000",
        date: "2024-03-02",
        amountCents: 2222,
        payee: "Gamma Co",
        desc: "Office supplies",
      },
    });

    assert.equal(response.statusCode, 201);
    const body = response.json();
    assert.equal(body.amountCents, 2222);
    assert.equal(body.date, new Date("2024-03-02T00:00:00.000Z").toISOString());
    assert.equal(body.orgId, "clorg123456000000000000000");
    assert.equal(body.payee, "Gamma Co");
    assert.equal(body.desc, "Office supplies");
    assert.equal(bankLineCreateCalls.length, 1);

    const amountDecimal = new Decimal(2222).dividedBy(100);
    assert.equal(
      (bankLineCreateCalls[0] as any).data.amount.toString(),
      amountDecimal.toString(),
    );
  });
});
