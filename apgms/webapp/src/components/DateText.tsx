import { useMemo } from 'react';

type DateTextProps = {
  value: string | number | Date;
  className?: string;
  options?: Intl.DateTimeFormatOptions;
};

export function DateText({ value, className, options }: DateTextProps) {
  const date = useMemo(() => new Date(value), [value]);
  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
        ...options
      }),
    [options]
  );

  return <time dateTime={date.toISOString()} className={className}>{formatter.format(date)}</time>;
}
