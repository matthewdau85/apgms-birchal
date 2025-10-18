import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteRpt,
  getRpt,
  mintRpt,
  resetRptStore,
  storeRptUnsafe,
  verifyChain,
  verifyRpt,
} from "../src/lib/rpt";

beforeEach(() => {
  resetRptStore();
  process.env.RPT_PRIVATE_KEY = "test-key";
});

describe("rpt token", () => {
  it("verifies minted token", async () => {
    const rpt = await mintRpt({
      orgId: "org-1",
      bankLineId: "bank-1",
      policyHash: "policy-1",
      allocations: [
        { accountId: "acct-1", amount: 50 },
        { accountId: "acct-2", amount: 50 },
      ],
      now: new Date().toISOString(),
    });

    await expect(verifyRpt(rpt)).resolves.toBe(true);
  });

  it("detects tampering", async () => {
    const rpt = await mintRpt({
      orgId: "org-1",
      bankLineId: "bank-1",
      policyHash: "policy-1",
      allocations: [{ accountId: "acct-1", amount: 100 }],
      now: new Date().toISOString(),
    });

    const tampered = { ...rpt, allocations: [{ accountId: "acct-1", amount: 101 }] };

    await expect(verifyRpt(tampered)).resolves.toBe(false);
  });

  it("fails when chain is broken", async () => {
    const first = await mintRpt({
      orgId: "org-1",
      bankLineId: "bank-1",
      policyHash: "policy-1",
      allocations: [{ accountId: "acct-1", amount: 100 }],
      now: new Date().toISOString(),
    });

    const second = await mintRpt({
      orgId: "org-1",
      bankLineId: "bank-1",
      policyHash: "policy-1",
      allocations: [{ accountId: "acct-2", amount: 100 }],
      prevHash: first.hash,
      now: new Date().toISOString(),
    });

    await expect(verifyChain(second.hash)).resolves.toBe(true);

    deleteRpt(first.hash);

    await expect(verifyChain(second.hash)).resolves.toBe(false);
  });

  it("detects tampered signatures in stored chain", async () => {
    const rpt = await mintRpt({
      orgId: "org-1",
      bankLineId: "bank-1",
      policyHash: "policy-1",
      allocations: [{ accountId: "acct-1", amount: 100 }],
      now: new Date().toISOString(),
    });

    const stored = getRpt(rpt.hash);
    if (!stored) throw new Error("missing rpt");
    const tampered = { ...stored, signature: "00" };
    deleteRpt(rpt.hash);
    storeRptUnsafe(tampered);

    await expect(verifyChain(tampered.hash)).resolves.toBe(false);
  });
});
