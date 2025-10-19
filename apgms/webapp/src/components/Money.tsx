import { memo } from 'react';

type MoneyProps = {
  value: number;
  currency?: string;
  minimumFractionDigits?: number;
};

const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(locale: string, currency: string, minimumFractionDigits?: number) {
  const key = `${locale}-${currency}-${minimumFractionDigits ?? 'default'}`;
  if (!formatterCache.has(key)) {
    formatterCache.set(
      key,
      new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits
      })
    );
  }
  return formatterCache.get(key)!;
}

export const Money = memo(function Money({ value, currency = 'USD', minimumFractionDigits }: MoneyProps) {
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
  const formatter = getFormatter(locale, currency, minimumFractionDigits);
  return <span>{formatter.format(value)}</span>;
});
