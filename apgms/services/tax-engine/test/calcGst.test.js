import test from 'node:test';
import assert from 'node:assert/strict';

import { calcGst } from '../src/calcGst.js';

test('calcGst applies gst.act.9-70 baseline and adjustments', () => {
  const inputs = {
    supplies: [
      { id: 'invoice-1', amount: 100 },
      { id: 'invoice-2', amount: 55, taxable: false },
      { id: 'invoice-3', amount: 14.25 },
    ],
    adjustments: [
      { id: 'credit-1', rule: 'credit-note', amount: 1.5, type: 'credit' },
      { id: 'refund-1', rule: 'refund-rule', amount: 2.0, type: 'refund' },
    ],
  };

  const rules = [
    { id: 'gst.act.9-70', type: 'baseline', rate: 0.1, rounding: 'bankers' },
    { id: 'credit-note', type: 'adjustment', mode: 'credit', rounding: 'tax' },
    { id: 'refund-rule', type: 'adjustment', mode: 'refund', rounding: 'tax' },
  ];

  const result = calcGst(inputs, rules);

  assert.strictEqual(result.gst_collected, 11.42);
  assert.strictEqual(result.gst_payable, 7.92);
  assert.strictEqual(result.breakdown.length, 5);

  const taxableEntries = result.breakdown.filter((entry) => entry.type === 'supply' && entry.taxable);
  assert.ok(taxableEntries.every((entry) => entry.rule === 'gst.act.9-70'));
  assert.strictEqual(taxableEntries[0].gst_amount, 10);
  assert.strictEqual(taxableEntries[1].gst_amount, 1.42);

  const nonTaxable = result.breakdown.find((entry) => entry.supply_id === 'invoice-2');
  assert.strictEqual(nonTaxable.gst_amount, 0);
  assert.strictEqual(nonTaxable.rule, 'gst.act.9-70');

  const creditAdjustment = result.breakdown.find((entry) => entry.rule === 'credit-note');
  assert.strictEqual(creditAdjustment.amount, -1.5);
  const refundAdjustment = result.breakdown.find((entry) => entry.rule === 'refund-rule');
  assert.strictEqual(refundAdjustment.amount, -2);
});

test('gst.act.9-70 rounding differs between bankers and tax rules', () => {
  const tieInputs = {
    supplies: [{ id: 'tie', amount: 14.25 }],
  };

  const bankers = calcGst(tieInputs, [
    { id: 'gst.act.9-70', type: 'baseline', rate: 0.1, rounding: 'bankers' },
  ]);
  const tax = calcGst(tieInputs, [
    { id: 'gst.act.9-70', type: 'baseline', rate: 0.1, rounding: 'tax' },
  ]);

  assert.strictEqual(bankers.breakdown[0].rule, 'gst.act.9-70');
  assert.strictEqual(bankers.breakdown[0].gst_amount, 1.42);
  assert.strictEqual(tax.breakdown[0].gst_amount, 1.43);
});

test('throws when gst.act.9-70 rule is missing', () => {
  assert.throws(() => calcGst({ supplies: [{ amount: 10 }] }, []), /gst\.act\.9-70/);
});
