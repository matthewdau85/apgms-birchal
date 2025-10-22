import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";

import type { BankLine, PrismaClient } from "@prisma/client";

import { createApp } from "../src/app";

type PrismaLike = Pick<
  PrismaClient,
  "bankLine" | "user" | "org" | "orgTombstone" | "$transaction"
>;

type BankLineState = Omit<BankLine, "occurredAt" | "createdAt"> & {
  occurredAt: Date;
  createdAt: Date;
};

type StubState = {
  bankLines: BankLineState[];
};

function createPrismaStub(initial?: Partial<StubState>): { client: PrismaLike; state: StubState } {
  const state: StubState = {
    bankLines: initial?.bankLines ?? [],
  };

  const client: PrismaLike = {
    bankLine: {
      findMany: async ({ orderBy, take }) => {
        let lines = [...state.bankLines];
        if (orderBy?.occurredAt === "desc") {
          lines.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
        }
        if (typeof take === "number") {
          lines = lines.slice(0, take);
        }
        return lines;
      },
      upsert: async ({ where, create }) => {
        const { orgId, externalId } = where.orgId_externalId;
        const existing = state.bankLines.find(
          (line) => line.orgId === orgId && line.externalId === externalId
        );
        if (existing) {
          return existing as unknown as BankLine;
        }
        const record: BankLineState = {
          id: create.id ?? randomUUID(),
          orgId: create.orgId!,
          externalId: create.externalId!,
          amountCents: create.amountCents!,
          occurredAt: create.occurredAt as Date,
          description: create.description ?? null,
          createdAt: create.createdAt ?? new Date(),
        };
        state.bankLines.push(record);
        return record as unknown as BankLine;
      },
    },
    user: {
      findMany: async () => [],
    },
    org: {
      findUnique: async () => null,
    },
    orgTombstone: {
      create: async () => ({}) as any,
    },
    $transaction: async (cb) => cb(client as any),
  } as unknown as PrismaLike;

  return { client, state };
}

test("POST /bank-lines requires authentication", async () => {
  const { client } = createPrismaStub();
  const app = await createApp({ prisma: client as unknown as PrismaClient });
  await app.ready();

  const response = await app.inject({
    method: "POST",
    url: "/bank-lines",
    payload: {
      externalId: "ext-1",
      amountCents: 1000,
      occurredAt: new Date().toISOString(),
    },
  });

  assert.equal(response.statusCode, 401);

  await app.close();
});

test("POST /bank-lines requires an idempotency key", async () => {
  const { client } = createPrismaStub();
  const app = await createApp({ prisma: client as unknown as PrismaClient });
  await app.ready();

  const response = await app.inject({
    method: "POST",
    url: "/bank-lines",
    payload: {
      externalId: "ext-1",
      amountCents: 1000,
      occurredAt: new Date().toISOString(),
    },
    headers: {
      authorization: "Bearer member:user-1:org-1",
    },
  });

  assert.equal(response.statusCode, 400);
  const body = response.json() as { error: string };
  assert.equal(body.error, "idempotency_key_required");

  await app.close();
});

test("POST /bank-lines validates the payload", async () => {
  const { client } = createPrismaStub();
  const app = await createApp({ prisma: client as unknown as PrismaClient });
  await app.ready();

  const response = await app.inject({
    method: "POST",
    url: "/bank-lines",
    payload: {
      externalId: "",
      amountCents: "not-a-number",
      occurredAt: "yesterday",
    },
    headers: {
      authorization: "Bearer member:user-1:org-1",
      "idempotency-key": "idem-1",
    },
  });

  assert.equal(response.statusCode, 400);

  await app.close();
});

test("POST /bank-lines upserts by external id", async () => {
  const { client, state } = createPrismaStub();
  const app = await createApp({ prisma: client as unknown as PrismaClient });
  await app.ready();

  const payload = {
    externalId: "ext-1",
    amountCents: 4200,
    occurredAt: new Date("2024-03-01T00:00:00Z").toISOString(),
    description: "Membership fee",
  };

  const first = await app.inject({
    method: "POST",
    url: "/bank-lines",
    payload,
    headers: {
      authorization: "Bearer member:user-1:org-1",
      "idempotency-key": "idem-1",
    },
  });

  assert.equal(first.statusCode, 200);
  const firstBody = first.json() as { id: string };
  assert.equal(state.bankLines.length, 1);

  const second = await app.inject({
    method: "POST",
    url: "/bank-lines",
    payload,
    headers: {
      authorization: "Bearer member:user-1:org-1",
      "idempotency-key": "idem-1",
    },
  });

  assert.equal(second.statusCode, 200);
  const secondBody = second.json() as { id: string };
  assert.equal(secondBody.id, firstBody.id);
  assert.equal(state.bankLines.length, 1);

  await app.close();
});
