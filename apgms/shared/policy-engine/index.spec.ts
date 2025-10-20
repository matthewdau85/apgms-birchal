import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  previewAllocations,
  type BankLine,
  type Ruleset,
} from './index';

const bankLineBase: BankLine = {
  id: 'txn-1',
  orgId: 'org-1',
  amountCents: 100_00,
  date: '2024-01-01',
  payee: 'Supplier',
  desc: 'Invoice payment',
};

const rulesetBase: Ruleset = {
  gstRate: 0.1,
  paygwRate: 0.2,
  taxBufferRate: 0.05,
  gates: {
    remit: true,
  },
};

describe('policy-engine previewAllocations', () => {
  it('preserves conservation of funds', () => {
    const preview = previewAllocations({
      bankLine: bankLineBase,
      ruleset: rulesetBase,
      accountStates: {},
    });

    const total = preview.allocations.reduce((sum, allocation) => sum + allocation.amountCents, 0);
    assert.equal(total, bankLineBase.amountCents);
    assert.ok(preview.allocations.every((allocation) => allocation.amountCents >= 0));
  });

  it('includes remit gate information in explain string', () => {
    const preview = previewAllocations({
      bankLine: bankLineBase,
      ruleset: { ...rulesetBase, gates: { remit: false } },
      accountStates: {},
    });

    assert.match(preview.explain, /remit gate disabled/);
  });

  it('uses bankers rounding to handle .5 down to even', () => {
    const preview = previewAllocations({
      bankLine: { ...bankLineBase, amountCents: 5 },
      ruleset: { ...rulesetBase, gstRate: 0.5, paygwRate: 0, taxBufferRate: 0 },
      accountStates: {},
    });

    const gst = preview.allocations.find((allocation) => allocation.bucket === 'GST');
    const operating = preview.allocations.find((allocation) => allocation.bucket === 'OPERATING');

    assert.equal(gst?.amountCents, 2);
    assert.equal(operating?.amountCents, 3);
  });

  it('uses bankers rounding to handle .5 up to odd', () => {
    const preview = previewAllocations({
      bankLine: { ...bankLineBase, amountCents: 5 },
      ruleset: { ...rulesetBase, gstRate: 0.3, paygwRate: 0, taxBufferRate: 0 },
      accountStates: {},
    });

    const gst = preview.allocations.find((allocation) => allocation.bucket === 'GST');
    const operating = preview.allocations.find((allocation) => allocation.bucket === 'OPERATING');

    assert.equal(gst?.amountCents, 2);
    assert.equal(operating?.amountCents, 3);
  });

  it('produces a stable policy hash', () => {
    const preview = previewAllocations({
      bankLine: bankLineBase,
      ruleset: rulesetBase,
      accountStates: {},
    });

    assert.equal(
      preview.policyHash,
      '9cea16547cbb9ae23736112897c1cec730cb1f51d07f86e5165ccc79bed1562b',
    );
  });

  it('clamps non-operating allocations when rates exceed total', () => {
    const preview = previewAllocations({
      bankLine: { ...bankLineBase, amountCents: 100 },
      ruleset: { ...rulesetBase, gstRate: 0.6, paygwRate: 0.6, taxBufferRate: 0.6 },
      accountStates: {},
    });

    const total = preview.allocations.reduce((sum, allocation) => sum + allocation.amountCents, 0);
    assert.equal(total, 100);
    assert.ok(preview.allocations.every((allocation) => allocation.amountCents >= 0));
    const operating = preview.allocations.find((allocation) => allocation.bucket === 'OPERATING');
    assert.equal(operating?.amountCents, 0);
  });
});
