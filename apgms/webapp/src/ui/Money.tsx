import { memo } from 'react';

type MoneyProps = {
  amount: number;
  currency?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  className?: string;
};

const formatterCache = new Map<string, Intl.NumberFormat>();

const getFormatter = (currency = 'USD', minimumFractionDigits = 2, maximumFractionDigits = 2) => {
  const key = `${currency}-${minimumFractionDigits}-${maximumFractionDigits}`;
  if (!formatterCache.has(key)) {
    formatterCache.set(
      key,
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        minimumFractionDigits,
        maximumFractionDigits,
      }),
    );
  }
  return formatterCache.get(key)!;
};

export const Money = memo(({ amount, currency = 'USD', minimumFractionDigits, maximumFractionDigits, className }: MoneyProps) => {
  const formatter = getFormatter(currency, minimumFractionDigits ?? 2, maximumFractionDigits ?? 2);
  return <span className={className}>{formatter.format(amount)}</span>;
});

Money.displayName = 'Money';
