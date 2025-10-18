import assert from "node:assert/strict";
import test from "node:test";

import type { Allocation } from "@apgms/policy-engine";
import { getRPT, mintRPT, resetRPTStore, verifyStoredRPT } from "../src/lib/rpt";

test("RPT signatures verify", async () => {
  resetRPTStore();

  const allocations: Allocation[] = [{ accountId: "ops", amount: 150, ruleId: "rule-ops" }];
  const rpt = await mintRPT({
    bankLineId: "bl-10",
    policyHash: "hash-1",
    allocations,
  });

  const verification = await verifyStoredRPT(rpt.id);
  assert.ok(verification.ok, "expected verification to succeed");
  if (verification.ok) {
    assert.strictEqual(verification.validSignature, true);
    assert.strictEqual(verification.validChain, true);
    assert.strictEqual(verification.chainDepth, 1);
  }
});

test("RPT chains must be contiguous", async () => {
  resetRPTStore();

  const allocations: Allocation[] = [{ accountId: "ops", amount: 200, ruleId: "rule-ops" }];
  const head = await mintRPT({
    bankLineId: "bl-11",
    policyHash: "policy-1",
    allocations,
  });

  const tail = await mintRPT({
    bankLineId: "bl-11",
    policyHash: "policy-1",
    allocations,
    prevHash: head.hash,
  });

  const verification = await verifyStoredRPT(tail.id);
  assert.ok(verification.ok, "expected chain verification to succeed");
  if (verification.ok) {
    assert.strictEqual(verification.validChain, true);
    assert.strictEqual(verification.chainDepth, 2);
  }
});

test("tampering invalidates the signature", async () => {
  resetRPTStore();

  const allocations: Allocation[] = [{ accountId: "ops", amount: 300, ruleId: "rule-ops" }];
  const rpt = await mintRPT({
    bankLineId: "bl-12",
    policyHash: "policy-2",
    allocations,
  });

  const stored = getRPT(rpt.id);
  assert.ok(stored);
  if (stored) {
    stored.allocations[0]!.amount = 9999;
  }

  const verification = await verifyStoredRPT(rpt.id);
  assert.ok(!verification.ok);
  if (!verification.ok && verification.error === "invalid") {
    assert.ok(verification.reason === "signature" || verification.reason === "hash");
  }
});
