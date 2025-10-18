import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  clearRptStore,
  getRpt,
  mintRpt,
  storeRpt,
  verifyChain,
  verifyRpt,
} from "../src/lib/rpt.js";

const baseAllocations = [
  { bucket: "primary", amountCents: 1_000, currency: "AUD" as const },
  { bucket: "remittance", amountCents: 500, currency: "AUD" as const },
];

describe("RPT lifecycle", () => {
  beforeEach(() => {
    clearRptStore();
  });

  it("verifies a freshly minted RPT", async () => {
    const rpt = await mintRpt({
      orgId: "org-1",
      bankLineId: "line-1",
      policyHash: "policy-abc",
      allocations: baseAllocations,
      now: new Date("2024-01-01T00:00:00Z"),
    });

    storeRpt(rpt);

    const verification = verifyRpt(rpt);
    assert.equal(verification.ok, true, verification.error);

    const chain = verifyChain(rpt.rptId);
    assert.equal(chain.ok, true, chain.error);
    assert.equal(chain.depth, 1);
  });

  it("fails verification when the payload is tampered", async () => {
    const rpt = await mintRpt({
      orgId: "org-1",
      bankLineId: "line-1",
      policyHash: "policy-abc",
      allocations: baseAllocations,
      now: new Date("2024-01-01T00:00:00Z"),
    });

    const tampered = {
      ...rpt,
      allocations: rpt.allocations.map((allocation, index) =>
        index === 0
          ? { ...allocation, amountCents: allocation.amountCents + 1 }
          : allocation,
      ),
    };

    const verification = verifyRpt(tampered);
    assert.equal(verification.ok, false);
  });

  it("detects breaks in the chain", async () => {
    const first = await mintRpt({
      orgId: "org-1",
      bankLineId: "line-1",
      policyHash: "policy-abc",
      allocations: baseAllocations,
      now: new Date("2024-01-01T00:00:00Z"),
    });
    storeRpt(first);

    const second = await mintRpt({
      orgId: "org-1",
      bankLineId: "line-2",
      policyHash: "policy-abc",
      allocations: baseAllocations,
      prevHash: first.digest,
      now: new Date("2024-01-01T01:00:00Z"),
    });
    storeRpt(second);

    const validChain = verifyChain(second.rptId);
    assert.equal(validChain.ok, true, validChain.error);
    assert.equal(validChain.depth, 2);

    const storedSecond = getRpt(second.rptId);
    assert.ok(storedSecond);
    storedSecond.prevHash = "broken";

    const brokenChain = verifyChain(second.rptId);
    assert.equal(brokenChain.ok, false);
  });
});
