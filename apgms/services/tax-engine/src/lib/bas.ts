import type { TaxRatesConfig } from '../config/tax-rates.js';
import type { CashLine, GstPeriod } from './gst.js';
import { calculateGst } from './gst.js';
import type { PayrollEntry, PayPeriod } from './paygw.js';
import { calculatePaygw } from './paygw.js';

export interface BasPeriod {
  readonly start: string;
  readonly end: string;
}

export interface BasLabels {
  readonly G1: number;
  readonly G2: number;
  readonly ['1A']: number;
  readonly ['1B']: number;
  readonly W1: number;
  readonly W2: number;
}

export interface BasDraftResult {
  readonly labels: BasLabels;
  readonly explain: readonly string[];
  readonly pdfStub?: string;
}

export interface BasDraftInput {
  readonly orgId: string;
  readonly period: BasPeriod;
  readonly lines: readonly CashLine[];
  readonly payroll: readonly PayrollEntry[];
}

export function draftBas(
  input: BasDraftInput,
  config: TaxRatesConfig
): BasDraftResult {
  const gstResult = calculateGst(input.orgId, input.lines, input.period as GstPeriod, config);
  const paygwResult = calculatePaygw(
    input.orgId,
    input.payroll,
    input.period as PayPeriod,
    config
  );

  const labels: BasLabels = {
    G1: gstResult.labels.G1,
    G2: gstResult.labels.G2,
    '1A': gstResult.labels['1A'],
    '1B': gstResult.labels['1B'],
    W1: paygwResult.W1,
    W2: paygwResult.W2
  };

  return {
    labels,
    explain: [...gstResult.explain, ...paygwResult.explain]
  };
}
