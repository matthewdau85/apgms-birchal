import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calcGst } from '../src/gst.js';

describe('calcGst', () => {
  const baselineRule = { code: 'gst.act.9-70' };

  it('applies the gst.act.9-70 baseline rate to taxable supplies', () => {
    const result = calcGst(
      [
        { amount: 100, taxable: true, description: 'Taxable supply' },
        { amount: 50, taxable: false, description: 'GST-free supply' },
      ],
      [baselineRule]
    );

    assert.equal(result.gst_collected, 10);
    assert.equal(result.gst_payable, 10);
    assert.deepEqual(result.breakdown.supplies[0], {
      description: 'Taxable supply',
      taxable: true,
      amount: 100,
      gst: 10,
      rule: 'gst.act.9-70',
    });
    assert.equal(result.breakdown.supplies[1].gst, 0);
  });

  it('performs bankers rounding when requested by rule', () => {
    const result = calcGst(
      [{ amount: 0.05 }],
      [
        baselineRule,
        { code: 'rounding.bankers', type: 'rounding', mode: 'bankers' },
      ]
    );

    assert.equal(result.breakdown.rounding.mode, 'bankers');
    assert.equal(result.gst_collected, 0);
    assert.equal(result.breakdown.supplies[0].rule, 'gst.act.9-70');
    assert.equal(result.breakdown.supplies[0].gst, 0);
  });

  it('performs tax rounding (half up) when requested by rule', () => {
    const result = calcGst(
      [{ amount: 0.05 }],
      [
        baselineRule,
        { code: 'rounding.tax', type: 'rounding', mode: 'tax' },
      ]
    );

    assert.equal(result.breakdown.rounding.mode, 'tax');
    assert.equal(result.gst_collected, 0.01);
    assert.equal(result.breakdown.supplies[0].rule, 'gst.act.9-70');
    assert.equal(result.breakdown.supplies[0].gst, 0.01);
  });

  it('applies adjustments supplied via rules and rounds totals consistently', () => {
    const result = calcGst(
      [
        { amount: 200, taxable: true },
        { amount: 19.99, taxable: true },
      ],
      [
        baselineRule,
        { code: 'rounding.tax', type: 'rounding', mode: 'tax' },
        { code: 'adjustment.refund', type: 'adjustment', amount: -5, reason: 'Refund credit' },
      ]
    );

    assert.equal(result.gst_collected, 22);
    assert.equal(result.gst_payable, 17);
    assert.deepEqual(result.breakdown.adjustments, [
      {
        code: 'adjustment.refund',
        amount: -5,
        reason: 'Refund credit',
      },
    ]);
  });
});
