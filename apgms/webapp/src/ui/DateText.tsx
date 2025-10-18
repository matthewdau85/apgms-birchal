import { format, isValid, parseISO } from 'date-fns';

type DateTextProps = {
  value: string | Date | null | undefined;
  pattern?: string;
};

export function DateText({ value, pattern = 'dd MMM yyyy' }: DateTextProps) {
  const date = typeof value === 'string' ? parseISO(value) : value instanceof Date ? value : null;

  if (!date || !isValid(date)) {
    return <span className="text-slate-400">—</span>;
  }

  return <time dateTime={date.toISOString()}>{format(date, pattern)}</time>;
}
