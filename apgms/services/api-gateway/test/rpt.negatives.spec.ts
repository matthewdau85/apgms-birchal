import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  hashRptPayload,
  signRpt,
  verifyChain,
  verifyRpt,
} from "../src/lib/rpt";

const baseAllocation = {
  id: "alloc-1",
  amount: "100.00",
  currency: "AUD",
};

const issuedAt = "2024-01-01T00:00:00.000Z";

describe("RPT negative scenarios", () => {
  it("fails to verify when allocation amount is tampered", () => {
    const rpt = signRpt({ allocation: baseAllocation, issuedAt });
    assert.equal(verifyRpt(rpt), true, "sanity check: valid RPT should verify");

    const tampered = {
      ...rpt,
      allocation: { ...rpt.allocation, amount: "101.00" },
    };

    assert.equal(verifyRpt(tampered), false);
  });

  it("fails to verify the chain when prevHash is broken", () => {
    const first = signRpt({ allocation: baseAllocation, issuedAt });

    const secondPayload = {
      allocation: { id: "alloc-2", amount: "50.00", currency: "AUD" },
      issuedAt: "2024-01-01T01:00:00.000Z",
      prevHash: hashRptPayload(first),
    };
    const second = signRpt(secondPayload);

    const validChain = [first, second];
    assert.equal(verifyChain(validChain), true, "sanity check: valid chain should verify");

    const brokenChain = [first, { ...second, prevHash: "ff".repeat(32) }];
    assert.equal(verifyChain(brokenChain), false);
  });
});
