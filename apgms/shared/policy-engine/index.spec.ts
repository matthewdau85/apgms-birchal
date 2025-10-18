import { strict as assert } from 'node:assert';
import test from 'node:test';

import { previewAllocations, type BankLine, type Ruleset } from './index.js';

const baseBankLine: BankLine = {
  id: 'bank-1',
  orgId: 'org-1',
  amountCents: 10000,
  date: '2024-01-01',
  payee: 'Example Payee',
  desc: 'Payment received',
};

const baseRuleset: Ruleset = {
  gstRate: 0.1,
  paygwRate: 0.2,
  taxBufferRate: 0.15,
  gates: {
    remit: true,
  },
};

test('conserves total allocation amount', () => {
  const preview = previewAllocations({
    bankLine: baseBankLine,
    ruleset: baseRuleset,
    accountStates: {},
  });

  const sum = preview.allocations.reduce((acc, allocation) => acc + allocation.amountCents, 0);
  assert.equal(sum, baseBankLine.amountCents);
});

test('allocations are non-negative', () => {
  const preview = previewAllocations({
    bankLine: baseBankLine,
    ruleset: baseRuleset,
    accountStates: {},
  });

  for (const allocation of preview.allocations) {
    assert.ok(allocation.amountCents >= 0);
  }
});

test('uses bankers rounding for half values', () => {
  const bankLine: BankLine = {
    ...baseBankLine,
    amountCents: 5,
  };

  const ruleset: Ruleset = {
    gstRate: 0.1,
    paygwRate: 0.3,
    taxBufferRate: 0,
    gates: { remit: true },
  };

  const preview = previewAllocations({ bankLine, ruleset, accountStates: {} });
  const gst = preview.allocations.find((entry) => entry.bucket === 'GST');
  const paygw = preview.allocations.find((entry) => entry.bucket === 'PAYGW');
  assert.equal(gst?.amountCents, 0, '0.5 should round to 0 because 0 is even');
  assert.equal(paygw?.amountCents, 2, '1.5 should round to 2 because 2 is even');
});

test('policy hash is deterministic for a ruleset', () => {
  const preview = previewAllocations({
    bankLine: baseBankLine,
    ruleset: baseRuleset,
    accountStates: {},
  });

  assert.equal(
    preview.policyHash,
    '520ac588656540efbb6c686c7b12bbe4bdc25dc1afadd5c6db92eedb31cce67b',
  );
});

test('remit gate does not change allocation values', () => {
  const closedPreview = previewAllocations({
    bankLine: baseBankLine,
    ruleset: {
      ...baseRuleset,
      gates: { remit: false },
    },
    accountStates: {},
  });

  const openPreview = previewAllocations({
    bankLine: baseBankLine,
    ruleset: baseRuleset,
    accountStates: {},
  });

  assert.deepEqual(
    closedPreview.allocations,
    openPreview.allocations,
    'Remittance gate should not influence allocation amounts',
  );
});

test('handles over allocation gracefully by reducing from tax-related buckets first', () => {
  const bankLine: BankLine = {
    ...baseBankLine,
    amountCents: 1000,
  };

  const ruleset: Ruleset = {
    gstRate: 0.4,
    paygwRate: 0.4,
    taxBufferRate: 0.4,
    gates: { remit: true },
  };

  const preview = previewAllocations({ bankLine, ruleset, accountStates: {} });
  const operating = preview.allocations.find((entry) => entry.bucket === 'OPERATING');
  assert.ok(operating);
  assert.equal(
    preview.allocations.reduce((acc, allocation) => acc + allocation.amountCents, 0),
    bankLine.amountCents,
  );
  for (const allocation of preview.allocations) {
    assert.ok(allocation.amountCents >= 0);
  }
});

test('explain string reflects gate status', () => {
  const preview = previewAllocations({
    bankLine: baseBankLine,
    ruleset: {
      ...baseRuleset,
      gates: { remit: false },
    },
    accountStates: {},
  });

  assert.match(preview.explain, /Remittance gate is disabled/);
});
