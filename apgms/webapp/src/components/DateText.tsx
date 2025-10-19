import React from 'react';

type DateTextProps = {
  value: string | number | Date;
  formatOptions?: Intl.DateTimeFormatOptions;
  locale?: string;
};

const DateText: React.FC<DateTextProps> = ({ value, locale = 'en-AU', formatOptions }) => {
  const date = React.useMemo(() => new Date(value), [value]);
  const formatter = React.useMemo(
    () =>
      new Intl.DateTimeFormat(locale, formatOptions ?? {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
    [formatOptions, locale]
  );
  return <time dateTime={date.toISOString()}>{formatter.format(date)}</time>;
};

export default DateText;
