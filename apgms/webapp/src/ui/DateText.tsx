import type { HTMLAttributes } from 'react';

type DateTextProps = {
  value?: string | Date | null;
} & HTMLAttributes<HTMLTimeElement>;

function toDate(value?: string | Date | null) {
  if (!value) {
    return undefined;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(value);
}

export function DateText({ value, className = '', ...rest }: DateTextProps) {
  const date = toDate(value);
  const formatted = date ? formatDate(date) : '—';

  return (
    <time
      className={[className, 'text-sm', 'text-slate-600', 'dark:text-slate-300']
        .filter(Boolean)
        .join(' ')}
      dateTime={date?.toISOString()}
      {...rest}
    >
      {formatted}
    </time>
  );
}

export default DateText;
