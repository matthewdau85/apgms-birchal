import type { HTMLAttributes } from 'react';

type MoneyProps = {
  cents?: number | null;
} & HTMLAttributes<HTMLSpanElement>;

function formatAUD(value: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function Money({ cents, className = '', ...rest }: MoneyProps) {
  const combinedClassName = ['money', 'tabular-nums', 'font-semibold', 'text-slate-900',
    'dark:text-slate-100', className]
    .filter(Boolean)
    .join(' ');

  if (cents === null || cents === undefined) {
    return (
      <span className={combinedClassName} aria-live="polite" {...rest}>
        —
      </span>
    );
  }

  const major = cents / 100;

  return (
    <span className={combinedClassName} aria-live="polite" {...rest}>
      {formatAUD(major)}
    </span>
  );
}

export default Money;
