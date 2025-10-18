import { forwardRef } from 'react';

type DateTextProps = {
  value: string | number | Date;
  options?: Intl.DateTimeFormatOptions;
  className?: string;
};

const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

const buildKey = (options?: Intl.DateTimeFormatOptions) => JSON.stringify(options ?? {});

const getDateFormatter = (options?: Intl.DateTimeFormatOptions) => {
  const key = buildKey(options);
  if (!dateFormatterCache.has(key)) {
    dateFormatterCache.set(key, new Intl.DateTimeFormat(undefined, options));
  }
  return dateFormatterCache.get(key)!;
};

export const DateText = forwardRef<HTMLSpanElement, DateTextProps>(
  ({ value, options, className }, ref) => {
    const formatter = getDateFormatter(
      options ?? { dateStyle: 'medium', timeStyle: undefined }
    );
    const date = value instanceof Date ? value : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return (
        <span ref={ref} className={className}>
          —
        </span>
      );
    }

    return (
      <span ref={ref} className={className}>
        {formatter.format(date)}
      </span>
    );
  }
);

DateText.displayName = 'DateText';
