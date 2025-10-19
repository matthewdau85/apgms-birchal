import { describe, it, expect, beforeEach } from "./harness";
import { buildApp } from "../services/api-gateway/src/app";
import { runGateScheduler } from "../worker/src/gate-scheduler";
import {
  PAYTO_GATE_ID,
  setGateStatus,
  resetInMemoryStore,
  inMemoryStore,
} from "@apgms/shared";

const ADMIN_HEADERS = { "x-admin-token": "local-admin" };

describe("PayTo integration", () => {
  beforeEach(async () => {
    resetInMemoryStore?.();
    await setGateStatus(PAYTO_GATE_ID, "CLOSED");
  });

  it("blocks remittance when gate is closed", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/payto/remit",
      headers: ADMIN_HEADERS,
      payload: { orgId: "org-1", amountCents: 5000 },
    });

    expect(response.statusCode).toBe(409);
    await app.close();
  });

  it("queues remittance and scheduler settles when gate open", async () => {
    await setGateStatus(PAYTO_GATE_ID, "OPEN");
    const app = await buildApp();

    const agreement = await app.inject({
      method: "POST",
      url: "/payto/agreements",
      headers: ADMIN_HEADERS,
      payload: {
        orgId: "org-1",
        maskedBsb: "***-123",
        maskedAcc: "***987",
      },
    });
    expect(agreement.statusCode).toBe(201);

    const remit = await app.inject({
      method: "POST",
      url: "/payto/remit",
      headers: ADMIN_HEADERS,
      payload: { orgId: "org-1", amountCents: 7500 },
    });
    expect(remit.statusCode).toBe(202);

    await runGateScheduler();

    const remittances = inMemoryStore?.remittances ?? [];
    expect(remittances).toHaveLength(1);
    expect(remittances[0].status).toBe("SUCCESS");

    const audit = (inMemoryStore?.auditBlobs ?? []).filter(
      (entry: any) => entry.scope === "payto.remit.processed",
    );
    expect(audit.length).toBeGreaterThan(0);

    await app.close();
  });
});
