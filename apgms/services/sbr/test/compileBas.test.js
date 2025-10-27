import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compileBas, __testing } from '../src/compileBas.js';

const period = { start: '2024-07-01', end: '2024-07-31' };

describe('compileBas', () => {
  it('maps GST and PAYGW results to BAS labels for a synthetic month', () => {
    const gstResult = {
      totalSales: 13579.49,
      gstOnSales: 1250.55,
      gstOnPurchases: 349.15
    };

    const paygwResult = {
      totalWages: 9800.75,
      taxWithheld: 1450.49
    };

    const bas = compileBas(period, gstResult, paygwResult);

    assert.deepStrictEqual(bas.period, period);
    assert.equal(bas.version, '1.0.0');
    assert.deepStrictEqual(Object.keys(bas.labels).sort(), ['1A', '1B', 'G1', 'W1', 'W2']);

    assert.equal(bas.labels.G1.rawAmount, gstResult.totalSales);
    assert.equal(bas.labels.G1.amount, 13579);
    assert.equal(bas.labels['1A'].rawAmount, gstResult.gstOnSales);
    assert.equal(bas.labels['1A'].amount, 1251);
    assert.equal(bas.labels['1B'].rawAmount, gstResult.gstOnPurchases);
    assert.equal(bas.labels['1B'].amount, 349);
    assert.equal(bas.labels.W1.rawAmount, paygwResult.totalWages);
    assert.equal(bas.labels.W1.amount, 9801);
    assert.equal(bas.labels.W2.rawAmount, paygwResult.taxWithheld);
    assert.equal(bas.labels.W2.amount, 1450);
  });

  it('rounds amounts to whole dollars following ATO guidance', () => {
    const gstResult = {
      totalSales: 100.49,
      gstOnSales: 100.5,
      gstOnPurchases: -100.5
    };

    const paygwResult = {
      totalWages: -100.49,
      taxWithheld: -100.5
    };

    const bas = compileBas('2024-08', gstResult, paygwResult);

    assert.equal(bas.labels.G1.amount, 100, '100.49 rounds down');
    assert.equal(bas.labels['1A'].amount, 101, '100.5 rounds up');
    assert.equal(bas.labels['1B'].amount, -101, '-100.5 rounds away from zero');
    assert.equal(bas.labels.W1.amount, -100, '-100.49 rounds toward zero');
    assert.equal(bas.labels.W2.amount, -101, '-100.5 rounds away from zero');
  });

  it('caches label definitions for reuse', () => {
    const first = __testing.loadDefinitions();
    const second = __testing.loadDefinitions();
    assert.strictEqual(first, second);
  });
});
