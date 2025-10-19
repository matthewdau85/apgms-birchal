import raw from './tax-rates.json' with { type: 'json' };

export type RoundingMode = 'HALF_UP' | 'HALF_EVEN';

export interface PaygwBand {
  readonly threshold: number;
  readonly marginalRate: number;
  readonly offset: number;
}

export interface TaxRoundingRules {
  readonly mode: RoundingMode;
  readonly scale: number;
}

export interface TaxRatesConfig {
  readonly gstRate: number;
  readonly paygwBands: readonly PaygwBand[];
  readonly rounding: TaxRoundingRules;
}

const config: TaxRatesConfig = {
  gstRate: raw.gstRate,
  paygwBands: raw.paygwBands,
  rounding: raw.rounding
};

export const taxRatesConfig: TaxRatesConfig = config;

export function resolvePaygwBand(amount: number, bands: readonly PaygwBand[]): PaygwBand {
  const sorted = [...bands].sort((a, b) => a.threshold - b.threshold);
  let candidate = sorted[0];
  for (const band of sorted) {
    if (amount >= band.threshold) {
      candidate = band;
    } else {
      break;
    }
  }
  return candidate;
}
