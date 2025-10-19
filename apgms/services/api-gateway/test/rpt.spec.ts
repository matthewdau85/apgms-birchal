import test from "node:test";
import assert from "node:assert/strict";
import { mintRpt, verifyRpt, verifyChain } from "../src/lib/rpt.js";
import { rotateKey } from "../src/lib/kms.js";

test("minted tokens verify successfully", async () => {
  const alias = `test-rpt-${Date.now()}`;
  await rotateKey(alias);
  const allocations = [
    { bucket: "ops", amountCents: 5000, currency: "AUD", memo: null },
    { bucket: "savings", amountCents: 2000, currency: "AUD", memo: null },
    { bucket: "tax", amountCents: 3000, currency: "AUD", memo: null },
  ];
  const minted = await mintRpt({
    orgId: "org",
    bankLineId: "bank-line-1",
    policyHash: "hash",
    allocations,
    prevHash: "GENESIS",
    now: new Date("2024-01-01T00:00:00Z"),
    keyAlias: alias,
  });
  const verified = await verifyRpt({ ...minted, timestamp: minted.timestamp });
  assert.equal(verified, true);
});

test("tampering invalidates signatures and broken chains fail", async () => {
  const alias = `test-rpt-chain-${Date.now()}`;
  await rotateKey(alias);
  const baseAllocations = [
    { bucket: "ops", amountCents: 6000, currency: "AUD", memo: null },
    { bucket: "reserve", amountCents: 4000, currency: "AUD", memo: null },
  ];
  const first = await mintRpt({
    orgId: "org",
    bankLineId: "bank-line-1",
    policyHash: "hash-1",
    allocations: baseAllocations,
    prevHash: "GENESIS",
    now: new Date("2024-01-01T00:00:00Z"),
    keyAlias: alias,
  });
  const second = await mintRpt({
    orgId: "org",
    bankLineId: "bank-line-2",
    policyHash: "hash-2",
    allocations: baseAllocations,
    prevHash: first.id,
    now: new Date("2024-01-01T00:05:00Z"),
    keyAlias: alias,
  });

  const tampered = { ...first, allocations: [{ ...first.allocations[0], amountCents: first.allocations[0].amountCents + 1 }, ...first.allocations.slice(1)] };
  const tamperedVerified = await verifyRpt({ ...tampered, timestamp: tampered.timestamp });
  assert.equal(tamperedVerified, false);

  const store = new Map<string, any>([
    [first.id, { ...first, allocationsJson: first.allocations, timestamp: first.timestamp }],
    [second.id, { ...second, allocationsJson: second.allocations, timestamp: second.timestamp }],
  ]);

  const validChain = await verifyChain(second.id, {
    loadRpt: async (id) => {
      const entry = store.get(id);
      if (!entry) return null;
      return {
        id: entry.id,
        orgId: entry.orgId,
        bankLineId: entry.bankLineId,
        policyHash: entry.policyHash,
        allocationsJson: entry.allocationsJson,
        prevHash: entry.prevHash,
        sig: entry.sig,
        timestamp: entry.timestamp,
      };
    },
  });
  assert.equal(validChain, true);

  const brokenStore = new Map<string, any>([
    [first.id, { ...first, allocationsJson: first.allocations, timestamp: first.timestamp }],
    [second.id, { ...second, allocationsJson: second.allocations, prevHash: "wrong", timestamp: second.timestamp }],
  ]);
  const brokenChain = await verifyChain(second.id, {
    loadRpt: async (id) => {
      const entry = brokenStore.get(id);
      if (!entry) return null;
      return {
        id: entry.id,
        orgId: entry.orgId,
        bankLineId: entry.bankLineId,
        policyHash: entry.policyHash,
        allocationsJson: entry.allocationsJson,
        prevHash: entry.prevHash,
        sig: entry.sig,
        timestamp: entry.timestamp,
      };
    },
  });
  assert.equal(brokenChain, false);

  const tamperedStore = new Map<string, any>([
    [first.id, { ...first, allocationsJson: [{ ...first.allocations[0], amountCents: first.allocations[0].amountCents + 10 }, ...first.allocations.slice(1)], timestamp: first.timestamp }],
    [second.id, { ...second, allocationsJson: second.allocations, timestamp: second.timestamp }],
  ]);
  const tamperedChain = await verifyChain(second.id, {
    loadRpt: async (id) => {
      const entry = tamperedStore.get(id);
      if (!entry) return null;
      return {
        id: entry.id,
        orgId: entry.orgId,
        bankLineId: entry.bankLineId,
        policyHash: entry.policyHash,
        allocationsJson: entry.allocationsJson,
        prevHash: entry.prevHash,
        sig: entry.sig,
        timestamp: entry.timestamp,
      };
    },
  });
  assert.equal(tamperedChain, false);
});
