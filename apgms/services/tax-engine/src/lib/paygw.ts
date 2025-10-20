import type { TaxRatesConfig } from '../config/tax-rates.js';
import { resolvePaygwBand } from '../config/tax-rates.js';
import { roundCents } from './rounding.js';

export interface PayPeriod {
  readonly start: string;
  readonly end: string;
}

export interface PayrollEntry {
  readonly id: string;
  readonly orgId: string;
  readonly grossCents: number;
  readonly payDate: string;
}

export interface PaygwResult {
  readonly W1: number;
  readonly W2: number;
  readonly explain: readonly string[];
}

export function calculatePaygw(
  orgId: string,
  payroll: readonly PayrollEntry[],
  period: PayPeriod,
  config: TaxRatesConfig
): PaygwResult {
  const items = payroll.filter(
    (entry) => entry.orgId === orgId && isWithinPeriod(entry.payDate, period)
  );

  let W1 = 0;
  let W2 = 0;
  const explain: string[] = [];

  for (const entry of items) {
    W1 += entry.grossCents;
    explain.push(`${entry.id}:W1:${entry.grossCents}`);

    const band = resolvePaygwBand(entry.grossCents, config.paygwBands);
    const rawWithheld = entry.grossCents * band.marginalRate - band.offset;
    const withheld = Math.max(0, roundCents(rawWithheld, config.rounding));
    W2 += withheld;
    explain.push(`${entry.id}:W2:${withheld}`);
  }

  return { W1, W2, explain };
}

function isWithinPeriod(date: string, period: PayPeriod): boolean {
  const current = new Date(date).getTime();
  return current >= new Date(period.start).getTime() && current <= new Date(period.end).getTime();
}
