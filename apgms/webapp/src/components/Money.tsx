import { memo } from 'react';

export interface MoneyProps {
  value: number;
  currency?: string;
  locale?: string;
  minimumFractionDigits?: number;
}

const formatterCache = new Map<string, Intl.NumberFormat>();

const getFormatter = (locale: string, currency: string, minimumFractionDigits: number) => {
  const cacheKey = `${locale}-${currency}-${minimumFractionDigits}`;
  if (!formatterCache.has(cacheKey)) {
    formatterCache.set(
      cacheKey,
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits,
        maximumFractionDigits: Math.max(2, minimumFractionDigits),
      }),
    );
  }

  return formatterCache.get(cacheKey)!;
};

const MoneyComponent = ({
  value,
  currency = 'USD',
  locale = 'en-US',
  minimumFractionDigits = 2,
}: MoneyProps) => {
  const formatter = getFormatter(locale, currency, minimumFractionDigits);
  return <span className="font-mono tabular-nums text-right">{formatter.format(value)}</span>;
};

export const Money = memo(MoneyComponent);
