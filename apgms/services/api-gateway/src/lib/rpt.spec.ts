import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveLedgerEntries,
  mintRpt,
  resetRptState,
  storeRptToken,
  verifyChain,
  verifyRpt,
} from "./rpt";

const baseRequest = {
  orgId: "org-1",
  bankLineId: "bank-1",
  policyHash: "policy-1",
  allocations: [
    { accountId: "acct-1", amount: 100 },
    { accountId: "acct-2", amount: -100 },
  ],
  now: "2024-01-01T00:00:00.000Z",
} as const;

test.beforeEach(() => {
  resetRptState();
});

test("minted RPT verifies", async () => {
  const rpt = await mintRpt(baseRequest);
  assert.equal(await verifyRpt(rpt), true);
});

test("tampering invalidates signature", async () => {
  const rpt = await mintRpt(baseRequest);
  const tampered = {
    ...rpt,
    payload: {
      ...rpt.payload,
      allocations: rpt.payload.allocations.map((allocation, index) =>
        index === 0
          ? { ...allocation, amount: allocation.amount + 1 }
          : allocation,
      ),
    },
  };

  assert.equal(await verifyRpt(tampered), false);
});

test("chain verification succeeds and fails when broken", async () => {
  const first = await mintRpt(baseRequest);
  storeRptToken(first, deriveLedgerEntries(first.payload, first.hash));

  const second = await mintRpt({
    ...baseRequest,
    bankLineId: "bank-2",
    prevHash: first.hash,
    now: "2024-01-01T01:00:00.000Z",
  });
  storeRptToken(second, deriveLedgerEntries(second.payload, second.hash));

  assert.equal(await verifyChain(second.hash), true);

  const orphan = await mintRpt({
    ...baseRequest,
    bankLineId: "bank-3",
    prevHash: "missing-hash",
    now: "2024-01-01T02:00:00.000Z",
  });
  storeRptToken(orphan, deriveLedgerEntries(orphan.payload, orphan.hash));

  assert.equal(await verifyChain(orphan.hash), false);
});
