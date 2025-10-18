import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { z } from "zod";
import replySchemaPlugin from "../src/plugins/reply-schema";
import { buildApp } from "../src/app";
import { healthResponseSchema } from "../src/schemas/dashboard";
import { listUsersResponseSchema } from "../src/schemas/users";
import {
  listBankLinesResponseSchema,
  createBankLineResponseSchema,
  createBankLineRequestSchema,
} from "../src/schemas/bank-lines";

process.env.NODE_ENV = "test";

const ORG_ID = "c123456789012345678901234";
const BANK_LINE_ID = "caaaaaaaaaaaaaaaaaaaaaaaa";
const SECOND_BANK_LINE_ID = "cbbbbbbbbbbbbbbbbbbbbbbbb";
const CREATED_BANK_LINE_ID = "ccccccccccccccccccccccccc";

const stubUsers = [
  {
    email: "user@example.com",
    orgId: ORG_ID,
    createdAt: new Date("2024-01-02T10:00:00.000Z"),
  },
  {
    email: "another@example.com",
    orgId: ORG_ID,
    createdAt: new Date("2024-01-01T09:00:00.000Z"),
  },
];

function buildPrismaStub() {
  const bankLines = [
    {
      id: BANK_LINE_ID,
      orgId: ORG_ID,
      date: new Date("2024-01-03T12:00:00.000Z"),
      amount: 25000,
      payee: "Acme Corp",
      desc: "Subscription",
      createdAt: new Date("2024-01-03T13:00:00.000Z"),
    },
    {
      id: SECOND_BANK_LINE_ID,
      orgId: ORG_ID,
      date: new Date("2024-01-02T12:00:00.000Z"),
      amount: 5000,
      payee: "Globex",
      desc: "Consulting",
      createdAt: new Date("2024-01-02T13:00:00.000Z"),
    },
  ];

  return {
    prisma: {
      user: {
        async findMany() {
          return stubUsers;
        },
      },
      bankLine: {
        async findMany(args: { take?: number }) {
          const take = args?.take ?? bankLines.length;
          return bankLines.slice(0, take);
        },
        async create({ data }: { data: { orgId: string; date: Date; amount: number; payee: string; desc: string } }) {
          const createdAt = new Date("2024-01-04T13:00:00.000Z");
          const created = {
            id: CREATED_BANK_LINE_ID,
            orgId: data.orgId,
            date: data.date,
            amount: data.amount,
            payee: data.payee,
            desc: data.desc,
            createdAt,
          };
          bankLines.unshift(created);
          return created;
        },
      },
    },
    bankLines,
  };
}

test("reply.withSchema throws on invalid payloads in development", async () => {
  const app = Fastify({ logger: false });
  await app.register(replySchemaPlugin);

  app.get("/bad", async (_req, reply) => {
    reply.withSchema(z.object({ ok: z.literal(true) }), { ok: false });
  });

  const response = await app.inject({ method: "GET", url: "/bad" });
  assert.equal(response.statusCode, 500);
  await app.close();
});

test("GET /health conforms to schema", async () => {
  const { prisma } = buildPrismaStub();
  const app = await buildApp({ prismaClient: prisma, logger: false });

  const response = await app.inject({ method: "GET", url: "/health" });
  assert.equal(response.statusCode, 200);
  const parsed = healthResponseSchema.parse(response.json());
  assert.deepEqual(parsed, { ok: true, service: "api-gateway" });

  await app.close();
});

test("GET /users validates response", async () => {
  const { prisma } = buildPrismaStub();
  const app = await buildApp({ prismaClient: prisma, logger: false });

  const response = await app.inject({ method: "GET", url: "/users" });
  assert.equal(response.statusCode, 200);
  const parsed = listUsersResponseSchema.parse(response.json());
  assert.equal(parsed.users.length, stubUsers.length);
  assert.deepEqual(parsed.users[0], {
    email: "user@example.com",
    orgId: ORG_ID,
    createdAt: stubUsers[0].createdAt.toISOString(),
  });

  await app.close();
});

test("GET /bank-lines validates list response", async () => {
  const { prisma, bankLines } = buildPrismaStub();
  const app = await buildApp({ prismaClient: prisma, logger: false });

  const response = await app.inject({ method: "GET", url: "/bank-lines" });
  assert.equal(response.statusCode, 200);
  const parsed = listBankLinesResponseSchema.parse(response.json());
  assert.equal(parsed.lines.length, bankLines.length);
  assert.deepEqual(parsed.lines[0], {
    id: BANK_LINE_ID,
    orgId: ORG_ID,
    date: bankLines[0].date.toISOString(),
    amountCents: bankLines[0].amount,
    payee: bankLines[0].payee,
    desc: bankLines[0].desc,
    createdAt: bankLines[0].createdAt.toISOString(),
  });

  await app.close();
});

test("POST /bank-lines validates response payload", async () => {
  const { prisma } = buildPrismaStub();
  const app = await buildApp({ prismaClient: prisma, logger: false });

  const requestBody = {
    orgId: ORG_ID,
    date: new Date("2024-01-05T12:00:00.000Z").toISOString(),
    amountCents: 1234,
    payee: "Example",
    desc: "Invoice",
  } satisfies z.infer<typeof createBankLineRequestSchema>;

  const response = await app.inject({
    method: "POST",
    url: "/bank-lines",
    payload: requestBody,
  });

  assert.equal(response.statusCode, 201);
  const parsed = createBankLineResponseSchema.parse(response.json());
  assert.equal(parsed.id, CREATED_BANK_LINE_ID);
  assert.equal(parsed.amountCents, requestBody.amountCents);

  await app.close();
});
