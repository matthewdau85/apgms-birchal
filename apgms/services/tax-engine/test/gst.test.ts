import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateGst, type CashLine, calculateComponent } from '../src/lib/gst.js';
import { TaxCode } from '../src/lib/codes.js';
import { taxRatesConfig } from '../src/config/tax-rates.js';

const basePeriod = { start: '2024-01-01', end: '2024-03-31' };

function buildLine(overrides: Partial<CashLine> = {}): CashLine {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    orgId: overrides.orgId ?? 'org-1',
    amountCents: overrides.amountCents ?? 10000,
    taxCode: overrides.taxCode ?? TaxCode.GST,
    direction: overrides.direction ?? 'sale',
    bookingDate: overrides.bookingDate ?? '2024-02-15'
  };
}

function createRandom(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

test('calculates GST payable and credits for cash lines', () => {
  const result = calculateGst(
    'org-1',
    [
      buildLine({ id: 'sale-1', amountCents: 11000, taxCode: TaxCode.GST, direction: 'sale' }),
      buildLine({ id: 'sale-2', amountCents: 5000, taxCode: TaxCode.FRE, direction: 'sale' }),
      buildLine({ id: 'purchase-1', amountCents: 22000, taxCode: TaxCode.GST, direction: 'purchase' }),
      buildLine({ id: 'purchase-2', amountCents: 15000, taxCode: TaxCode.CAP, direction: 'purchase' })
    ],
    basePeriod,
    taxRatesConfig
  );

  assert.equal(result.labels.G1, 16000);
  assert.equal(result.labels.G2, 5000);
  assert.equal(
    result.labels['1A'],
    calculateComponent(11000, taxRatesConfig.gstRate, taxRatesConfig)
  );
  assert.equal(
    result.labels['1B'],
    calculateComponent(22000, taxRatesConfig.gstRate, taxRatesConfig) +
      calculateComponent(15000, taxRatesConfig.gstRate, taxRatesConfig)
  );
});

test('ignores lines for other organisations and outside period bounds', () => {
  const result = calculateGst(
    'org-1',
    [
      buildLine({ id: 'included-start', bookingDate: basePeriod.start }),
      buildLine({ id: 'included-end', bookingDate: basePeriod.end }),
      buildLine({ id: 'other-org', orgId: 'org-2' }),
      buildLine({ id: 'before-period', bookingDate: '2023-12-31' }),
      buildLine({ id: 'after-period', bookingDate: '2024-04-01' })
    ],
    basePeriod,
    taxRatesConfig
  );

  assert.equal(result.labels.G1, 20000);
  assert(result.explain.some((entry) => entry.startsWith('included-start')));
  assert(result.explain.some((entry) => entry.startsWith('included-end')));
  assert.equal(result.explain.some((entry) => entry.startsWith('other-org')), false);
  assert.equal(result.explain.some((entry) => entry.startsWith('before-period')), false);
  assert.equal(result.explain.some((entry) => entry.startsWith('after-period')), false);
});

test('GST rounding is additive under configured rules', () => {
  const random = createRandom(42);
  for (let run = 0; run < 50; run += 1) {
    const length = 1 + Math.floor(random() * 15);
    const amounts: number[] = [];
    for (let index = 0; index < length; index += 1) {
      amounts.push(1 + Math.floor(random() * 500_000));
    }

    const lines: CashLine[] = amounts.map((amount, index) => ({
      id: `sale-${run}-${index}`,
      orgId: 'org-1',
      amountCents: amount,
      taxCode: TaxCode.GST,
      direction: 'sale',
      bookingDate: '2024-02-01'
    }));

    const result = calculateGst('org-1', lines, basePeriod, taxRatesConfig);
    const expected = amounts
      .map((amount) => calculateComponent(amount, taxRatesConfig.gstRate, taxRatesConfig))
      .reduce((total, current) => total + current, 0);

    assert.equal(result.labels['1A'], expected);
  }
});
