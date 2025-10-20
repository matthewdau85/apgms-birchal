/**
 * Monetary policy helpers built on integer-safe arithmetic.
 *
 * Rounding follows "half away from zero" semantics – the fractional part is
 * compared against half of the rounding unit and the magnitude is increased by
 * one when the remainder is greater than or equal to that midpoint. This keeps
 * positive and negative values symmetric while avoiding floating point drift.
 */
export interface MonetaryAmount {
  currency: string;
  amount: string | number | bigint;
}

export interface NormalisedAmount {
  currency: string;
  amount: string;
}

export interface RoundingOptions {
  scale?: number;
}

const DEFAULT_SCALE = 2;
const MIN_SCALE = 0;
const DECIMAL_PATTERN = /^-?\d+(?:\.\d+)?$/;

interface ParsedInput {
  sign: 1 | -1;
  digits: string;
  scale: number;
}

function pow10(exp: number): bigint {
  if (exp < 0) {
    throw new RangeError('Exponent must be non-negative');
  }

  let result = 1n;
  for (let i = 0; i < exp; i += 1) {
    result *= 10n;
  }
  return result;
}

function parseInput(value: string | number | bigint): ParsedInput {
  if (typeof value === 'bigint') {
    if (value === 0n) {
      return { sign: 1, digits: '0', scale: 0 };
    }
    const sign = value < 0n ? -1 : 1;
    const digits = (sign === -1 ? -value : value).toString();
    return { sign, digits, scale: 0 };
  }

  const raw = typeof value === 'number' ? value.toString() : String(value).trim();

  if (!DECIMAL_PATTERN.test(raw)) {
    throw new TypeError(`Invalid decimal value: ${value}`);
  }

  const isNegative = raw.startsWith('-');
  const unsigned = isNegative ? raw.slice(1) : raw;
  const [integerPart, fractionalPart = ''] = unsigned.split('.');
  const digits = `${integerPart}${fractionalPart}`.replace(/^0+(?=\d)/, '') || '0';
  const scale = fractionalPart.length;

  if (digits === '0') {
    return { sign: 1, digits, scale: 0 };
  }

  return {
    sign: isNegative ? -1 : 1,
    digits,
    scale,
  };
}

function formatMagnitude(sign: 1 | -1, magnitude: bigint, scale: number): string {
  const normalisedSign = magnitude === 0n ? 1 : sign;
  let digits = magnitude.toString();

  if (scale === 0) {
    return normalisedSign === -1 ? `-${digits}` : digits;
  }

  if (digits.length <= scale) {
    digits = digits.padStart(scale + 1, '0');
  }

  const integerPart = digits.slice(0, digits.length - scale) || '0';
  const fractionalPart = digits.slice(-scale);
  const prefix = normalisedSign === -1 ? '-' : '';
  return `${prefix}${integerPart}.${fractionalPart}`;
}

function assertScale(scale: number): void {
  if (!Number.isInteger(scale) || scale < MIN_SCALE) {
    throw new RangeError('Scale must be a non-negative integer');
  }
}

function roundToScale(value: string | number | bigint, scale: number): bigint {
  assertScale(scale);
  const { sign, digits, scale: currentScale } = parseInput(value);

  if (digits === '0') {
    return 0n;
  }

  let magnitude = BigInt(digits);

  if (currentScale === scale) {
    return sign === -1 ? -magnitude : magnitude;
  }

  if (currentScale < scale) {
    magnitude *= pow10(scale - currentScale);
    return sign === -1 ? -magnitude : magnitude;
  }

  const diff = currentScale - scale;
  const divisor = pow10(diff);
  const quotient = magnitude / divisor;
  const remainder = magnitude % divisor;
  const shouldRound = remainder * 2n >= divisor;

  let rounded = quotient;
  if (remainder !== 0n && shouldRound) {
    rounded += 1n;
  }

  return sign === -1 ? -rounded : rounded;
}

function roundHalfAwayFromZero(value: string | number | bigint, scale: number): string {
  const rounded = roundToScale(value, scale);
  const sign = rounded < 0n ? -1 : 1;
  const magnitude = rounded < 0n ? -rounded : rounded;
  return formatMagnitude(sign as 1 | -1, magnitude, scale);
}

export function normaliseAmount(amount: MonetaryAmount, options: RoundingOptions = {}): NormalisedAmount {
  const { scale = DEFAULT_SCALE } = options;
  assertScale(scale);
  const rounded = roundHalfAwayFromZero(amount.amount, scale);
  return {
    currency: amount.currency,
    amount: rounded,
  };
}

export function roundValue(value: string | number | bigint, options: RoundingOptions = {}): string {
  const { scale = DEFAULT_SCALE } = options;
  assertScale(scale);
  return roundHalfAwayFromZero(value, scale);
}

export function sumAmounts(amounts: MonetaryAmount[], options: RoundingOptions = {}): NormalisedAmount {
  if (amounts.length === 0) {
    throw new RangeError('At least one amount is required');
  }

  const { scale = DEFAULT_SCALE } = options;
  assertScale(scale);
  const currency = amounts[0].currency;

  let total = 0n;
  for (const amount of amounts) {
    if (amount.currency !== currency) {
      throw new TypeError('Currency mismatch in policy calculation');
    }
    total += roundToScale(amount.amount, scale);
  }

  const sign = total < 0n ? -1 : 1;
  const magnitude = total < 0n ? -total : total;
  return {
    currency,
    amount: formatMagnitude(sign as 1 | -1, magnitude, scale),
  };
}
