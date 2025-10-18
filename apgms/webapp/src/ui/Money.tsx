import { forwardRef } from 'react';

type MoneyProps = {
  value: number;
  currency?: string;
  showSign?: boolean;
  className?: string;
  align?: 'start' | 'end';
};

const formatterCache = new Map<string, Intl.NumberFormat>();

const getFormatter = (currency: string) => {
  if (!formatterCache.has(currency)) {
    formatterCache.set(
      currency,
      new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
        currencyDisplay: 'symbol',
        maximumFractionDigits: 2
      })
    );
  }

  return formatterCache.get(currency)!;
};

export const Money = forwardRef<HTMLSpanElement, MoneyProps>(
  ({ value, currency = 'USD', showSign = false, align = 'end', className }, ref) => {
    const formatter = getFormatter(currency);
    const formatted = formatter.format(Math.abs(value));
    const sign = showSign && value !== 0 ? (value > 0 ? '+' : '-') : '';
    const classes = [
      'tabular-nums',
      align === 'end' ? 'text-right' : 'text-left',
      'font-medium',
      className
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <span ref={ref} className={classes}>
        {sign}
        {formatted}
      </span>
    );
  }
);

Money.displayName = 'Money';
