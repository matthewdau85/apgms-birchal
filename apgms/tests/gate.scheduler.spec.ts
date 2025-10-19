import { describe, it, expect, beforeEach } from "./harness";
import { runGateScheduler } from "../worker/src/gate-scheduler";
import { prisma, setGateStatus, PAYTO_GATE_ID, resetInMemoryStore } from "@apgms/shared";

describe("gate scheduler", () => {
  beforeEach(async () => {
    resetInMemoryStore?.();
  });

  it("does nothing when gate is closed", async () => {
    const result = await runGateScheduler();
    expect(result.processed).toBe(0);
    expect(result.gate).toBe("CLOSED");
  });

  it("processes queued remittances when gate open", async () => {
    await setGateStatus(PAYTO_GATE_ID, "OPEN");
    await prisma.payToRemittance.create({
      data: { orgId: "org-1", amountCents: 1000, status: "QUEUED" },
    });
    await prisma.payToRemittance.create({
      data: { orgId: "org-1", amountCents: 2000, status: "QUEUED" },
    });

    const result = await runGateScheduler();
    expect(result.processed).toBe(2);

    const statuses = (await prisma.payToRemittance.findMany({})).map(
      (r: any) => r.status,
    );
    expect(statuses).toEqual(["SUCCESS", "SUCCESS"]);
  });
});
