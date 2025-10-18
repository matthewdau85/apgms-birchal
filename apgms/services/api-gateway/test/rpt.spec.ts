import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  mintRpt,
  persistRpt,
  resetRptStore,
  verifyChain,
  verifyRpt,
} from "../src/lib/rpt.js";

const sampleAllocations = [
  { allocationId: "alloc-1", amountCents: 2500, memo: "primary" },
  { allocationId: "alloc-2", amountCents: 5000 },
];

const mintSampleRpt = (overrides: Partial<Parameters<typeof mintRpt>[0]> = {}) => {
  return mintRpt({
    rptId: overrides.rptId ?? `rpt-${randomUUID()}`,
    orgId: overrides.orgId ?? "org-1",
    bankLineId: overrides.bankLineId ?? "bank-line-1",
    policyHash: overrides.policyHash ?? "policy-1",
    allocations: overrides.allocations ?? sampleAllocations,
    prevHash: overrides.prevHash ?? null,
    timestamp: overrides.timestamp,
  });
};

test("mint and verify RPT token", () => {
  resetRptStore();
  const minted = mintSampleRpt({ rptId: "rpt-1" });
  persistRpt(minted);

  const verification = verifyRpt(minted.token);
  assert.equal(verification.ok, true);
  assert.equal(verification.hash, minted.hash);
});

test("tampering allocations fails verification", () => {
  resetRptStore();
  const minted = mintSampleRpt({ rptId: "rpt-2" });
  persistRpt(minted);

  const tampered = {
    ...minted.token,
    allocations: minted.token.allocations.map((allocation, index) =>
      index === 0 ? { ...allocation, amountCents: allocation.amountCents + 1 } : allocation,
    ),
  };

  const verification = verifyRpt(tampered);
  assert.equal(verification.ok, false);
  assert.equal(verification.reason, "invalid_signature");
});

test("verifyChain detects prevHash mismatch", () => {
  resetRptStore();
  const first = mintSampleRpt({ rptId: "rpt-3" });
  const storedFirst = persistRpt(first);

  const second = mintSampleRpt({
    rptId: "rpt-4",
    prevHash: storedFirst.hash,
    bankLineId: "bank-line-2",
  });
  const storedSecond = persistRpt(second);

  const chainOk = verifyChain(storedSecond.token.rptId);
  assert.equal(chainOk.ok, true);

  const badLink = mintSampleRpt({
    rptId: "rpt-5",
    prevHash: "bogus-prev",
    bankLineId: "bank-line-3",
  });
  persistRpt(badLink);

  const broken = verifyChain(badLink.token.rptId);
  assert.equal(broken.ok, false);
  assert.equal(broken.rptId, badLink.token.rptId);
  assert.equal(broken.reason, "prev_hash_not_found");
});
