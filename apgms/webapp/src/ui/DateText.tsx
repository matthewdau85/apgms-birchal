import React from 'react';

export interface DateTextProps {
  value?: string | Date | null;
  className?: string;
  fallback?: React.ReactNode;
}

const dateFormatter = new Intl.DateTimeFormat('en-AU', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const joinClassNames = (...values: Array<string | undefined>) =>
  values.filter(Boolean).join(' ');

const toDateInstance = (value?: string | Date | null): Date | null => {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const DateText: React.FC<DateTextProps> = ({ value, className, fallback = '—' }) => {
  const dateValue = toDateInstance(value);

  if (!dateValue) {
    return <span className={joinClassNames('date-text', className)}>{fallback}</span>;
  }

  const formatted = dateFormatter.format(dateValue);

  return (
    <time
      className={joinClassNames('date-text', className)}
      dateTime={dateValue.toISOString()}
      suppressHydrationWarning
    >
      {formatted}
    </time>
  );
};

export default DateText;
