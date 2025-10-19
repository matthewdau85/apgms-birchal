import { memo } from 'react';

type DateTimeProps = {
  value?: string | number | Date;
  className?: string;
  variant?: 'date' | 'datetime';
};

const formatValue = (value?: string | number | Date, variant: 'date' | 'datetime' = 'datetime') => {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return variant === 'date'
    ? date.toLocaleDateString()
    : date.toLocaleString(undefined, { hour12: false });
};

export const DateTime = memo(({ value, className, variant = 'datetime' }: DateTimeProps) => (
  <time className={className} dateTime={value ? new Date(value).toISOString() : undefined}>
    {formatValue(value, variant)}
  </time>
));

DateTime.displayName = 'DateTime';
