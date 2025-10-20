import test from 'node:test';
import assert from 'node:assert/strict';
import { draftBas } from '../src/lib/bas.js';
import { TaxCode } from '../src/lib/codes.js';
import { taxRatesConfig } from '../src/config/tax-rates.js';
import type { CashLine } from '../src/lib/gst.js';
import type { PayrollEntry } from '../src/lib/paygw.js';

const period = { start: '2024-01-01', end: '2024-03-31' };

test('combines GST and PAYGW labels into a BAS summary', () => {
  const lines: CashLine[] = [
    {
      id: 'sale-1',
      orgId: 'org-1',
      amountCents: 11000,
      taxCode: TaxCode.GST,
      direction: 'sale',
      bookingDate: '2024-02-02'
    },
    {
      id: 'purchase-1',
      orgId: 'org-1',
      amountCents: 5500,
      taxCode: TaxCode.CAP,
      direction: 'purchase',
      bookingDate: '2024-02-15'
    }
  ];

  const payroll: PayrollEntry[] = [
    {
      id: 'pay-1',
      orgId: 'org-1',
      grossCents: 500_00,
      payDate: '2024-02-10'
    }
  ];

  const result = draftBas({ orgId: 'org-1', period, lines, payroll }, taxRatesConfig);

  assert.equal(result.labels.G1, 11000);
  assert(result.labels['1A'] > 0);
  assert(result.labels['1B'] > 0);
  assert.equal(result.labels.W1, 500_00);
  assert(result.labels.W2 > 0);
  assert.equal(result.explain.length, 5);
});
