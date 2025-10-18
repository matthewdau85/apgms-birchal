import { useMemo } from 'react';

type DateTextProps = {
  value?: string;
  className?: string;
  options?: Intl.DateTimeFormatOptions;
};

function DateText({ value, className, options }: DateTextProps): JSX.Element {
  const { formatted, isValid } = useMemo(() => {
    if (!value) {
      return { formatted: 'Not available', isValid: false };
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return { formatted: 'Not available', isValid: false };
    }

    const formatter = new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options
    });

    return { formatted: formatter.format(parsed), isValid: true };
  }, [options, value]);

  return (
    <span className={`text-sm text-muted-foreground ${className ?? ''}`.trim()}>
      {isValid ? formatted : 'Not available'}
    </span>
  );
}

export default DateText;
