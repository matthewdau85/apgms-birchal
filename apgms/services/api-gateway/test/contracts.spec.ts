import assert from "node:assert/strict";
import { test } from "node:test";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { createApp } from "../src/app";

const prismaMock = {
  user: {
    findMany: async () => [
      { email: "founder@example.com", orgId: "org-1", createdAt: new Date("2024-01-01T00:00:00.000Z") },
    ],
  },
  bankLine: {
    findMany: async () => [
      {
        id: "line-1",
        orgId: "org-1",
        date: new Date("2024-01-02T00:00:00.000Z"),
        amount: 1500.25,
        payee: "Acme",
        desc: "Office fit-out",
        createdAt: new Date("2024-01-03T00:00:00.000Z"),
      },
    ],
    create: async ({ data }: { data: any }) => ({
      id: "line-2",
      orgId: data.orgId,
      date: data.date,
      amount: data.amount,
      payee: data.payee,
      desc: data.desc,
      createdAt: new Date("2024-01-04T00:00:00.000Z"),
    }),
  },
} satisfies Partial<PrismaClient>;

test("rejects malformed bank line payloads", async (t) => {
  const app = (await createApp({ prisma: prismaMock as PrismaClient }, { logger: false })) as FastifyInstance;
  t.after(() => app.close());

  const response = await app.inject({
    method: "POST",
    url: "/bank-lines",
    payload: {
      orgId: "org-1",
      date: "not-a-date",
      amount: "abc",
      payee: "",
    },
  });

  assert.equal(response.statusCode, 400);
  const body = response.json();
  assert.equal(body.error, "bad_request");
});

test("responds with schema conformant payloads", async (t) => {
  const app = (await createApp({ prisma: prismaMock as PrismaClient }, { logger: false })) as FastifyInstance;
  t.after(() => app.close());

  const usersResponse = await app.inject({ method: "GET", url: "/users" });
  assert.equal(usersResponse.statusCode, 200);
  const usersBody = usersResponse.json();
  assert.deepEqual(usersBody, {
    users: [
      {
        email: "founder@example.com",
        orgId: "org-1",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    ],
  });

  const linesResponse = await app.inject({ method: "GET", url: "/bank-lines" });
  assert.equal(linesResponse.statusCode, 200);
  const linesBody = linesResponse.json();
  assert.deepEqual(linesBody, {
    lines: [
      {
        id: "line-1",
        orgId: "org-1",
        date: "2024-01-02T00:00:00.000Z",
        amount: "1500.25",
        payee: "Acme",
        desc: "Office fit-out",
        createdAt: "2024-01-03T00:00:00.000Z",
      },
    ],
  });

  const createResponse = await app.inject({
    method: "POST",
    url: "/bank-lines",
    payload: {
      orgId: "org-1",
      date: "2024-01-05T00:00:00.000Z",
      amount: "2500.50",
      payee: "Birchal",
      desc: "Investment",
    },
  });

  assert.equal(createResponse.statusCode, 201);
  const createBody = createResponse.json();
  assert.deepEqual(createBody, {
    id: "line-2",
    orgId: "org-1",
    date: "2024-01-05T00:00:00.000Z",
    amount: "2500.5",
    payee: "Birchal",
    desc: "Investment",
    createdAt: "2024-01-04T00:00:00.000Z",
  });
});
