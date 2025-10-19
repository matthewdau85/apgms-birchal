import clsx from 'clsx';

export type DateTextProps = {
  value: string | Date;
  options?: Intl.DateTimeFormatOptions;
  className?: string;
};

const defaultOptions: Intl.DateTimeFormatOptions = {
  dateStyle: 'medium'
};

const getFormatter = (options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-AU', options ?? defaultOptions);

const ensureDate = (value: string | Date) => (value instanceof Date ? value : new Date(value));

export const DateText = ({ value, options, className }: DateTextProps) => {
  const formatter = getFormatter(options);
  return <span className={clsx('tabular-nums text-sm text-slate-500', className)}>{formatter.format(ensureDate(value))}</span>;
};
