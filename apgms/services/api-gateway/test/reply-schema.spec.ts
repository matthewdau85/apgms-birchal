import assert from "node:assert/strict";
import { test } from "node:test";

import Fastify from "fastify";
import { z } from "zod";

import { decorateReplyWithSchema } from "../src/plugins/reply-schema";
import { buildApp } from "../src/index";

const restoreNodeEnv = (value: string | undefined) => {
  if (value === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = value;
  }
};

test("reply.withSchema throws on invalid payloads in dev", async (t) => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";

  const app = Fastify({ logger: false });
  decorateReplyWithSchema(app);

  app.get("/invalid", async (_, reply) =>
    reply.withSchema(
      z.object({ amountCents: z.number().int() }),
      { amountCents: "not-a-number" } as unknown as { amountCents: number }
    )
  );

  await app.ready();

  t.after(async () => {
    await app.close();
    restoreNodeEnv(originalEnv);
  });

  const response = await app.inject({ method: "GET", url: "/invalid" });

  assert.equal(response.statusCode, 500);
  const body = JSON.parse(response.body);
  assert.equal(body.message, "Reply schema validation failed");
});

test("route replies satisfy their schemas", async (t) => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "test";

  const userCreatedAt = new Date("2024-01-01T00:00:00.000Z");
  const bankLine = {
    id: "line-1",
    orgId: "org-1",
    date: new Date("2024-01-02T00:00:00.000Z"),
    amount: 123.45,
    payee: "Test Payee",
    desc: "Test description",
    createdAt: new Date("2024-01-03T00:00:00.000Z"),
  } as const;

  const prismaStub = {
    user: {
      findMany: async () => [
        {
          email: "user@example.com",
          orgId: "org-1",
          createdAt: userCreatedAt,
        },
      ],
    },
    bankLine: {
      findMany: async () => [bankLine],
      create: async ({ data }: { data: any }) => ({
        id: "line-created",
        orgId: data.orgId,
        date: new Date(data.date),
        amount: data.amount,
        payee: data.payee,
        desc: data.desc,
        createdAt: new Date("2024-01-04T00:00:00.000Z"),
      }),
    },
  } as const;

  const app = await buildApp({ prisma: prismaStub as any, logger: false });
  await app.ready();

  t.after(async () => {
    await app.close();
    restoreNodeEnv(originalEnv);
  });

  const usersResponse = await app.inject({ method: "GET", url: "/users" });
  assert.equal(usersResponse.statusCode, 200);
  assert.deepEqual(JSON.parse(usersResponse.body), {
    users: [
      {
        email: "user@example.com",
        orgId: "org-1",
        createdAt: userCreatedAt.toISOString(),
      },
    ],
  });

  const bankLinesResponse = await app.inject({
    method: "GET",
    url: "/bank-lines",
  });
  assert.equal(bankLinesResponse.statusCode, 200);

  const bankLinesBody = JSON.parse(bankLinesResponse.body);
  assert.equal(bankLinesBody.lines.length, 1);
  assert.equal(bankLinesBody.lines[0].amountCents, 12345);
  assert.equal(bankLinesBody.lines[0].description, "Test description");
  assert.equal(bankLinesBody.lines[0].payee, "Test Payee");
  assert.equal(bankLinesBody.lines[0].orgId, "org-1");
  assert.equal(bankLinesBody.lines[0].date, bankLine.date.toISOString());
  assert.equal(
    bankLinesBody.lines[0].createdAt,
    bankLine.createdAt.toISOString()
  );
});

