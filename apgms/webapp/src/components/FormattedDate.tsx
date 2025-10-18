import { memo } from 'react';

export interface FormattedDateProps {
  value: string | number | Date;
  locale?: string;
  options?: Intl.DateTimeFormatOptions;
}

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

const getDateFormatter = (locale: string, options: Intl.DateTimeFormatOptions) => {
  const cacheKey = `${locale}-${Object.entries(options)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${String(value)}`)
    .join('|')}`;

  if (!dateFormatterCache.has(cacheKey)) {
    dateFormatterCache.set(cacheKey, new Intl.DateTimeFormat(locale, options));
  }

  return dateFormatterCache.get(cacheKey)!;
};

const FormattedDateComponent = ({
  value,
  locale = 'en-US',
  options = { year: 'numeric', month: 'short', day: 'numeric' },
}: FormattedDateProps) => {
  const formatter = getDateFormatter(locale, options);
  const date = value instanceof Date ? value : new Date(value);
  return <span className="font-mono tabular-nums">{formatter.format(date)}</span>;
};

export const FormattedDate = memo(FormattedDateComponent);
