import clsx from 'clsx';

const formatterCache = new Map<string, Intl.NumberFormat>();

export type MoneyProps = {
  value: number;
  currency?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
  signDisplay?: 'auto' | 'always' | 'never' | 'exceptZero';
  className?: string;
};

const getFormatter = (
  currency: string,
  minimumFractionDigits: number | undefined,
  maximumFractionDigits: number | undefined,
  signDisplay: MoneyProps['signDisplay']
) => {
  const key = [currency, minimumFractionDigits, maximumFractionDigits, signDisplay].join(':');
  const existing = formatterCache.get(key);
  if (existing) {
    return existing;
  }

  const formatter = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
    signDisplay
  });
  formatterCache.set(key, formatter);
  return formatter;
};

export const Money = ({
  value,
  currency = 'AUD',
  minimumFractionDigits,
  maximumFractionDigits,
  signDisplay = 'auto',
  className
}: MoneyProps) => {
  const formatter = getFormatter(currency, minimumFractionDigits, maximumFractionDigits, signDisplay);
  return <span className={clsx('tabular-nums', className)}>{formatter.format(value)}</span>;
};
