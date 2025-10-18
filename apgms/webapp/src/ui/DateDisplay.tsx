import React from 'react';
import clsx from 'clsx';

type DateDisplayProps = {
  value: string | Date;
  className?: string;
  withTime?: boolean;
};

const dateFormatter = new Intl.DateTimeFormat('en-AU', {
  year: 'numeric',
  month: 'short',
  day: 'numeric'
});

const dateTimeFormatter = new Intl.DateTimeFormat('en-AU', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit'
});

export function DateDisplay({ value, className, withTime = false }: DateDisplayProps) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const formatted = (withTime ? dateTimeFormatter : dateFormatter).format(date);
  return (
    <time dateTime={date.toISOString()} className={clsx('tabular-nums text-slate-600 dark:text-slate-300', className)}>
      {formatted}
    </time>
  );
}
