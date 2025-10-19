import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePaygw, type PayrollEntry } from '../src/lib/paygw.js';
import { taxRatesConfig, resolvePaygwBand } from '../src/config/tax-rates.js';
import { roundCents } from '../src/lib/rounding.js';

const period = { start: '2024-01-01', end: '2024-03-31' };

function buildEntry(overrides: Partial<PayrollEntry> = {}): PayrollEntry {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    orgId: overrides.orgId ?? 'org-1',
    grossCents: overrides.grossCents ?? 300_00,
    payDate: overrides.payDate ?? '2024-02-01'
  };
}

function createRandom(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 48271) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

test('totals gross wages and withholding within the requested period', () => {
  const result = calculatePaygw(
    'org-1',
    [
      buildEntry({ id: 'match-start', payDate: period.start }),
      buildEntry({ id: 'match-end', payDate: period.end }),
      buildEntry({ id: 'other-org', orgId: 'org-2' }),
      buildEntry({ id: 'before', payDate: '2023-12-31' }),
      buildEntry({ id: 'after', payDate: '2024-04-01' })
    ],
    period,
    taxRatesConfig
  );

  const expectedGross = 600_00;
  assert.equal(result.W1, expectedGross);
  assert(result.explain.some((entry) => entry.startsWith('match-start:W1')));
  assert(result.explain.some((entry) => entry.startsWith('match-end:W1')));
  assert.equal(result.explain.some((entry) => entry.startsWith('other-org:W1')), false);
  assert.equal(result.explain.some((entry) => entry.startsWith('before:W1')), false);
  assert.equal(result.explain.some((entry) => entry.startsWith('after:W1')), false);
});

test('withholding is additive under rounding rules', () => {
  const random = createRandom(99);
  for (let run = 0; run < 50; run += 1) {
    const length = 1 + Math.floor(random() * 12);
    const grosses: number[] = [];
    for (let index = 0; index < length; index += 1) {
      grosses.push(1 + Math.floor(random() * 400_000));
    }

    const payroll: PayrollEntry[] = grosses.map((gross, index) => ({
      id: `pay-${run}-${index}`,
      orgId: 'org-1',
      grossCents: gross,
      payDate: '2024-02-02'
    }));

    const result = calculatePaygw('org-1', payroll, period, taxRatesConfig);
    const expected = grosses
      .map((gross) => {
        const band = resolvePaygwBand(gross, taxRatesConfig.paygwBands);
        const raw = gross * band.marginalRate - band.offset;
        return Math.max(0, roundCents(raw, taxRatesConfig.rounding));
      })
      .reduce((total, current) => total + current, 0);

    assert.equal(result.W2, expected);
  }
});
