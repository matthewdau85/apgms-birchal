import { useMemo } from 'react';

type MoneyProps = {
  value: number;
  currency?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  className?: string;
};

function Money({
  value,
  currency,
  minimumFractionDigits = 2,
  maximumFractionDigits = 2,
  className
}: MoneyProps): JSX.Element {
  const formatter = useMemo(
    () =>
      new Intl.NumberFormat(undefined, {
        style: currency ? 'currency' : 'decimal',
        currency: currency ?? undefined,
        minimumFractionDigits,
        maximumFractionDigits,
        notation: 'standard'
      }),
    [currency, maximumFractionDigits, minimumFractionDigits]
  );

  const formatted = formatter.format(value);

  return <span className={`tabular-nums ${className ?? ''}`.trim()}>{formatted}</span>;
}

export default Money;
