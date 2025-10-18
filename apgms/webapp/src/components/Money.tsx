import { useMemo } from 'react';

export type MoneyProps = {
  value: number;
  currency?: string;
  className?: string;
  minimumFractionDigits?: number;
};

export function Money({
  value,
  currency = 'USD',
  className,
  minimumFractionDigits = 2
}: MoneyProps) {
  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        minimumFractionDigits,
        maximumFractionDigits: Math.max(2, minimumFractionDigits)
      }),
    [currency, minimumFractionDigits]
  );

  return <span className={className}>{formatter.format(value)}</span>;
}
