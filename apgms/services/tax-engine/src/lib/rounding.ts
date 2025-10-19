import type { TaxRoundingRules } from '../config/tax-rates.js';

export function roundCents(amount: number, rules: TaxRoundingRules): number {
  const scale = Math.max(0, rules.scale);
  const factor = 10 ** scale;
  const scaled = amount * factor;
  const rounded = rules.mode === 'HALF_EVEN'
    ? roundHalfEven(scaled)
    : roundHalfUp(scaled);
  return Math.trunc(rounded);
}

export function roundCurrency(amount: number, rules: TaxRoundingRules): number {
  const cents = Math.round(amount * 100);
  return roundCents(cents, rules);
}

function roundHalfUp(value: number): number {
  const sign = Math.sign(value) || 1;
  return Math.floor(Math.abs(value) + 0.5) * sign;
}

function roundHalfEven(value: number): number {
  const sign = Math.sign(value) || 1;
  const abs = Math.abs(value);
  const floor = Math.floor(abs);
  const fraction = abs - floor;
  if (fraction > 0.5) {
    return (floor + 1) * sign;
  }
  if (fraction < 0.5) {
    return floor * sign;
  }
  if (floor % 2 === 0) {
    return floor * sign;
  }
  return (floor + 1) * sign;
}
