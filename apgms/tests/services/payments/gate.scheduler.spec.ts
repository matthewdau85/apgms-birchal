import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "@apgms/api-gateway/index";
import { createAgreement } from "@apgms/payments/adapters/payto.mock";
import { listAuditBlobs } from "@apgms/shared/audit-blob";
import { setGateState } from "@apgms/shared/gates";
import { getRedisClient } from "@apgms/services-shared/redis";
import { GateScheduler } from "@apgms/worker/gate-scheduler";

import type { FastifyInstance } from "fastify";

describe("Gate scheduler integration", () => {
  let app: FastifyInstance;
  const redis = getRedisClient();

  beforeEach(async () => {
    app = await buildApp({ logger: false });
  });

  afterEach(async () => {
    await app.close();
  });

  it("rejects remittance when gate is closed", async () => {
    const orgId = "org_closed";
    setGateState(orgId, "CLOSED");

    const agreement = await createAgreement({
      orgId,
      payeeName: "Bob",
      bsb: "654321",
      acc: "987654321",
    });

    const response = await app.inject({
      method: "POST",
      url: "/payto/remit",
      headers: {
        "x-role": "payments",
        "x-org-id": orgId,
      },
      payload: {
        agreementId: agreement.agreementId,
        amountCents: 5000,
        currency: "AUD",
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "gate_closed" });
    expect(await redis.llen(`remit:${orgId}`)).toBe(0);
  });

  it("queues when open and worker sends remittance", async () => {
    const orgId = "org_open";
    setGateState(orgId, "OPEN");

    const agreement = await createAgreement({
      orgId,
      payeeName: "Charlie",
      bsb: "111222",
      acc: "000111222",
    });

    const response = await app.inject({
      method: "POST",
      url: "/payto/remit",
      headers: {
        "x-role": "payments",
        "x-org-id": orgId,
      },
      payload: {
        agreementId: agreement.agreementId,
        amountCents: 2000,
        currency: "AUD",
      },
    });

    expect(response.statusCode).toBe(202);
    expect(response.json()).toMatchObject({ status: "QUEUED" });
    expect(await redis.llen(`remit:${orgId}`)).toBe(1);

    const scheduler = new GateScheduler({ pollIntervalMs: 10, redis });
    await scheduler.tick();

    const sentAudit = listAuditBlobs().find((blob) => blob.kind === "payto.remit.sent");
    expect(sentAudit).toBeTruthy();
    expect(await redis.llen(`remit:${orgId}`)).toBe(0);
  });
});
