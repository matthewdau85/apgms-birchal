import { behaviourFor, isTaxCode, TaxCode } from './codes.js';
import type { TaxRatesConfig } from '../config/tax-rates.js';
import { roundCents } from './rounding.js';

export interface GstPeriod {
  readonly start: string;
  readonly end: string;
}

export type CashDirection = 'sale' | 'purchase';

export interface CashLine {
  readonly id: string;
  readonly orgId: string;
  readonly amountCents: number;
  readonly taxCode: TaxCode;
  readonly direction: CashDirection;
  readonly bookingDate: string;
}

export interface GstLabels {
  readonly ['1A']: number;
  readonly ['1B']: number;
  readonly G1: number;
  readonly G2: number;
}

export interface GstResult {
  readonly labels: GstLabels;
  readonly explain: readonly string[];
}

export function calculateGst(
  orgId: string,
  lines: readonly CashLine[],
  period: GstPeriod,
  config: TaxRatesConfig
): GstResult {
  const effectiveLines = lines.filter((line) =>
    line.orgId === orgId && isWithinPeriod(line.bookingDate, period)
  );

  let label1A = 0;
  let label1B = 0;
  let labelG1 = 0;
  let labelG2 = 0;
  const explain: string[] = [];

  for (const line of effectiveLines) {
    if (!isTaxCode(line.taxCode)) {
      continue;
    }
    const behaviour = behaviourFor(line.taxCode);

    if (line.direction === 'sale') {
      if (behaviour.reportsSale) {
        labelG1 += line.amountCents;
        explain.push(`${line.id}:G1:${line.amountCents}`);
      }
      if (behaviour.reportsFree) {
        labelG2 += line.amountCents;
        explain.push(`${line.id}:G2:${line.amountCents}`);
      }
      if (behaviour.collectsGst) {
        const gstCents = calculateComponent(line.amountCents, config.gstRate, config);
        label1A += gstCents;
        explain.push(`${line.id}:1A:${gstCents}`);
      }
    } else {
      if (behaviour.claimsGst) {
        const gstCents = calculateComponent(line.amountCents, config.gstRate, config);
        label1B += gstCents;
        explain.push(`${line.id}:1B:${gstCents}`);
      }
    }
  }

  return {
    labels: {
      '1A': label1A,
      '1B': label1B,
      G1: labelG1,
      G2: labelG2
    },
    explain
  };
}

function isWithinPeriod(date: string, period: GstPeriod): boolean {
  const current = new Date(date).getTime();
  return current >= new Date(period.start).getTime() && current <= new Date(period.end).getTime();
}

export function calculateComponent(amountCents: number, rate: number, config: TaxRatesConfig): number {
  if (amountCents === 0) {
    return 0;
  }
  const factor = rate / (1 + rate);
  const component = amountCents * factor;
  return roundCents(component, config.rounding);
}
