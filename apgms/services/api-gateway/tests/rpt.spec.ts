import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  mintRpt,
  verifyRpt,
  verifyChain,
  resetRptStore,
  getRptById,
} from "../src/lib/rpt";

describe("RPT signing", () => {
  beforeEach(() => {
    resetRptStore();
  });

  it("should verify a freshly minted RPT", () => {
    const rpt = mintRpt({
      orgId: "org-1",
      bankLineId: "line-1",
      policyHash: "policy-abc",
      allocations: [
        { accountId: "acct-1", amount: 1000, currency: "AUD" },
        { accountId: "acct-2", amount: 500 },
      ],
      now: new Date("2024-01-01T00:00:00Z"),
    });

    assert.equal(verifyRpt(rpt), true, "minted RPT should verify");
    const chain = verifyChain(rpt.rptId);
    assert.equal(chain.valid, true, "single RPT chain should be valid");
  });

  it("should fail verification when payload is tampered", () => {
    const rpt = mintRpt({
      orgId: "org-1",
      bankLineId: "line-1",
      policyHash: "policy-abc",
      allocations: [{ accountId: "acct-1", amount: 1000 }],
      now: new Date("2024-01-01T00:00:00Z"),
    });

    rpt.payload.allocations[0].amount = 999;

    assert.equal(verifyRpt(rpt), false, "tampered RPT should not verify");
  });

  it("should detect a broken prevHash chain", () => {
    const first = mintRpt({
      orgId: "org-1",
      bankLineId: "line-1",
      policyHash: "policy-abc",
      allocations: [{ accountId: "acct-1", amount: 1000 }],
      now: new Date("2024-01-01T00:00:00Z"),
    });

    const second = mintRpt({
      orgId: "org-1",
      bankLineId: "line-1",
      policyHash: "policy-abc",
      allocations: [{ accountId: "acct-1", amount: 2000 }],
      prevHash: first.payload.hash,
      now: new Date("2024-01-02T00:00:00Z"),
    });

    const storedSecond = getRptById(second.rptId);
    assert.ok(storedSecond);
    if (storedSecond) {
      storedSecond.payload.prevHash = "broken";
    }

    const chain = verifyChain(second.rptId);
    assert.equal(chain.valid, false, "chain should be invalid when prevHash is broken");
    assert.equal(chain.brokenAt, second.rptId, "chain should flag the tampered record");
  });
});
