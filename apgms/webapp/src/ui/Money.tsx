import React from 'react';
import clsx from 'clsx';

type MoneyProps = {
  value: number;
  currency?: string;
  minimumFractionDigits?: number;
  className?: string;
};

const formatterCache = new Map<string, Intl.NumberFormat>();

export function Money({ value, currency = 'AUD', minimumFractionDigits = 2, className }: MoneyProps) {
  const key = `${currency}-${minimumFractionDigits}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency,
      minimumFractionDigits,
      maximumFractionDigits: minimumFractionDigits
    });
    formatterCache.set(key, formatter);
  }

  return (
    <span
      className={clsx(
        'tabular-nums',
        value < 0 ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300',
        className
      )}
    >
      {formatter.format(value)}
    </span>
  );
}
