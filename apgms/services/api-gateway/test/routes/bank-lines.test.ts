import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { FastifyInstance } from "fastify";
import { prisma } from "@apgms/shared/src/db";
import {
  idempotencyRedis,
  shutdownIdempotency,
} from "@apgms/shared/src/idempotency";
import { createApp } from "../../src/index";

const TEST_ORG_ID = "org-test";
const OTHER_ORG_ID = "org-other";

async function ensureOrgs() {
  await prisma.org.upsert({
    where: { id: TEST_ORG_ID },
    update: {},
    create: { id: TEST_ORG_ID, name: "Test Org" },
  });
  await prisma.org.upsert({
    where: { id: OTHER_ORG_ID },
    update: {},
    create: { id: OTHER_ORG_ID, name: "Other Org" },
  });
}

describe("/v1/bank-lines routes", { concurrency: false }, () => {
  let app: FastifyInstance;

  before(async () => {
    await ensureOrgs();
    app = await createApp();
  });

  beforeEach(async () => {
    await idempotencyRedis.flushdb();
    await prisma.bankLine.deleteMany({ where: { orgId: { in: [TEST_ORG_ID, OTHER_ORG_ID] } } });
  });

  after(async () => {
    await app.close();
    await prisma.bankLine.deleteMany({ where: { orgId: { in: [TEST_ORG_ID, OTHER_ORG_ID] } } });
    await prisma.org.deleteMany({ where: { id: { in: [TEST_ORG_ID, OTHER_ORG_ID] } } });
    await shutdownIdempotency();
    await prisma.$disconnect();
  });

  it("returns paginated bank lines for the authenticated org", async () => {
    const now = new Date("2025-01-01T12:00:00.000Z");
    const oneDay = 24 * 60 * 60 * 1000;

    const newest = await prisma.bankLine.create({
      data: {
        orgId: TEST_ORG_ID,
        date: new Date(now.getTime()),
        amount: 2500.5,
        payee: "Birchal",
        desc: "Capital injection",
      },
    });
    const middle = await prisma.bankLine.create({
      data: {
        orgId: TEST_ORG_ID,
        date: new Date(now.getTime() - oneDay),
        amount: -199.99,
        payee: "CloudCo",
        desc: "SaaS subscription",
      },
    });
    await prisma.bankLine.create({
      data: {
        orgId: TEST_ORG_ID,
        date: new Date(now.getTime() - oneDay * 2),
        amount: 1050.0,
        payee: "Acme",
        desc: "Office refit",
      },
    });

    await prisma.bankLine.create({
      data: {
        orgId: OTHER_ORG_ID,
        date: new Date(now.getTime()),
        amount: 999.0,
        payee: "ShouldNotSee",
        desc: "Hidden",
      },
    });

    const firstPage = await app.inject({
      method: "GET",
      url: "/v1/bank-lines?limit=2",
      headers: { "x-org-id": TEST_ORG_ID },
    });

    assert.strictEqual(firstPage.statusCode, 200);
    const firstPayload = firstPage.json() as {
      data: Array<{ id: string; orgId: string }>;
      nextCursor: string | null;
    };

    assert.strictEqual(firstPayload.data.length, 2);
    assert.ok(firstPayload.data.every((item) => item.orgId === TEST_ORG_ID));
    assert.strictEqual(firstPayload.data[0].id, newest.id);
    assert.strictEqual(firstPayload.data[1].id, middle.id);
    assert.ok(firstPayload.nextCursor);

    const secondPage = await app.inject({
      method: "GET",
      url: `/v1/bank-lines?limit=2&cursor=${firstPayload.nextCursor}`,
      headers: { "x-org-id": TEST_ORG_ID },
    });

    assert.strictEqual(secondPage.statusCode, 200);
    const secondPayload = secondPage.json() as {
      data: Array<{ id: string; orgId: string }>;
      nextCursor: string | null;
    };

    assert.strictEqual(secondPayload.data.length, 1);
    assert.strictEqual(secondPayload.data[0].orgId, TEST_ORG_ID);
    assert.strictEqual(secondPayload.nextCursor, null);
  });

  it("returns 400 when validation fails", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/v1/bank-lines",
      headers: {
        "x-org-id": TEST_ORG_ID,
        "Idempotency-Key": "validation-case",
      },
      payload: {
        date: "not-a-date",
        amount: "not-a-number",
        payee: "",
        desc: "",
      },
    });

    assert.strictEqual(response.statusCode, 400);
    const body = response.json() as { error: string };
    assert.strictEqual(body.error, "invalid_body");
  });

  it("replays the original response when the idempotency key is reused", async () => {
    const payload = {
      date: "2025-01-05T10:00:00.000Z",
      amount: "1200.75",
      payee: "Launch Supplies",
      desc: "New hire equipment",
    };

    const first = await app.inject({
      method: "POST",
      url: "/v1/bank-lines",
      headers: {
        "x-org-id": TEST_ORG_ID,
        "Idempotency-Key": "idem-key",
      },
      payload,
    });

    assert.strictEqual(first.statusCode, 201);
    const firstBody = first.json() as { id: string };

    const second = await app.inject({
      method: "POST",
      url: "/v1/bank-lines",
      headers: {
        "x-org-id": TEST_ORG_ID,
        "Idempotency-Key": "idem-key",
      },
      payload,
    });

    assert.strictEqual(second.statusCode, 201);
    const replayBody = second.json() as { id: string };
    assert.strictEqual(replayBody.id, firstBody.id);
    assert.strictEqual(second.headers["x-idempotent-replay"], "true");

    const createdCount = await prisma.bankLine.count({
      where: { orgId: TEST_ORG_ID, payee: payload.payee },
    });
    assert.strictEqual(createdCount, 1);
  });
});
