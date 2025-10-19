import { memo } from 'react';

type DateTextProps = {
  value: string | Date;
  variant?: 'long' | 'short';
};

export const DateText = memo(function DateText({ value, variant = 'long' }: DateTextProps) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const options: Intl.DateTimeFormatOptions =
    variant === 'long'
      ? { year: 'numeric', month: 'long', day: 'numeric' }
      : { year: 'numeric', month: 'short', day: 'numeric' };
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
  const formatter = new Intl.DateTimeFormat(locale, options);
  return <time dateTime={date.toISOString()}>{formatter.format(date)}</time>;
});
