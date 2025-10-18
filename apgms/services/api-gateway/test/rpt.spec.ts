import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getRptToken,
  mintRpt,
  recordLedgerEntry,
  resetRptState,
  storeRptToken,
  verifyChain,
  verifyRpt,
} from "../src/lib/rpt";

const baseInput = {
  orgId: "org_123",
  bankLineId: "line_abc",
  policyHash: "policy_v1",
  allocations: [
    { accountId: "wages", amount: "1250.00" },
    { accountId: "tax", amount: "350.00" },
  ],
  prevHash: null as string | null,
};

test("mintRpt and verifyRpt succeed for valid payload", () => {
  resetRptState();
  const rpt = mintRpt({ ...baseInput, now: new Date("2024-07-01T00:00:00.000Z") });
  assert.ok(rpt.signature.length > 0, "signature should be present");
  assert.doesNotThrow(() => verifyRpt(rpt));
});

test("verifyChain passes for a valid linked list of RPTs", () => {
  resetRptState();
  const first = mintRpt({ ...baseInput, now: new Date("2024-07-01T00:00:00.000Z") });
  storeRptToken(first);
  recordLedgerEntry({
    orgId: first.orgId,
    bankLineId: first.bankLineId,
    rptHash: first.hash,
    allocations: first.allocations,
    now: new Date("2024-07-01T00:00:01.000Z"),
  });

  const second = mintRpt({
    ...baseInput,
    bankLineId: "line_def",
    prevHash: first.hash,
    now: new Date("2024-07-01T00:05:00.000Z"),
  });
  storeRptToken(second);

  assert.doesNotThrow(() => verifyChain(second.hash));
});

test("verifyRpt throws when payload is tampered", () => {
  resetRptState();
  const rpt = mintRpt({ ...baseInput, now: new Date("2024-07-01T00:00:00.000Z") });
  const tampered = {
    ...rpt,
    allocations: [...rpt.allocations, { accountId: "ops", amount: "50.00" }],
  };
  assert.throws(() => verifyRpt(tampered), /Invalid RPT signature/);
});

test("verifyChain fails when prevHash is broken", () => {
  resetRptState();
  const first = mintRpt({ ...baseInput, now: new Date("2024-07-01T00:00:00.000Z") });
  storeRptToken(first);

  const broken = mintRpt({
    ...baseInput,
    bankLineId: "line_xyz",
    prevHash: "deadbeef",
    now: new Date("2024-07-01T00:10:00.000Z"),
  });
  storeRptToken(broken);

  assert.throws(() => verifyChain(broken.hash), /Missing RPT/);
  assert.ok(getRptToken(first.hash));
});
