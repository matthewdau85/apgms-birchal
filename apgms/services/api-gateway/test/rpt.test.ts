import assert from "node:assert";

import {
  __resetRptStoreForTests,
  __setRptTokenForTests,
  mintRpt,
  verifyChain,
  verifyRpt,
} from "../src/lib/rpt";

import type { RptToken } from "../src/lib/rpt";

function sampleAllocations() {
  return [
    {
      accountId: "acct-1",
      amount: 50,
      ruleId: "rule#0",
      weight: 1,
      gate: "OPEN" as const,
    },
    {
      accountId: "acct-2",
      amount: 25,
      ruleId: "rule#1",
      weight: 1,
      gate: "OPEN" as const,
    },
  ];
}

async function runRptTests(): Promise<void> {
  __resetRptStoreForTests();

  const first = mintRpt({
    bankLineId: "bank-1",
    policyHash: "hash-1",
    allocations: sampleAllocations(),
    prevHash: null,
    now: new Date().toISOString(),
  });

  assert.ok(verifyRpt(first), "minted token should verify");

  const second = mintRpt({
    bankLineId: "bank-2",
    policyHash: "hash-2",
    allocations: sampleAllocations(),
    prevHash: first.hash,
    now: new Date().toISOString(),
  });

  assert.ok(await verifyChain(second.id), "chain should verify");

  const tampered: RptToken = {
    ...first,
    payload: { ...first.payload, policyHash: "tampered" },
  };

  __setRptTokenForTests(tampered);

  assert.ok(!verifyRpt(tampered), "tampering should break signature");
  assert.ok(!(await verifyChain(second.id)), "chain should fail after tamper");
}

runRptTests()
  .then(() => {
    console.log("rpt tests passed");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
