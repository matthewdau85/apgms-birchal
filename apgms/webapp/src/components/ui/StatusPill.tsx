import type { HTMLAttributes } from 'react';

const toneMap: Record<string, string> = {
  success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-100 text-amber-700 border-amber-200',
  danger: 'bg-rose-100 text-rose-700 border-rose-200',
  info: 'bg-blue-100 text-blue-700 border-blue-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
};

export interface StatusPillProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
}

export const StatusPill = ({ tone = 'neutral', className, children, ...props }: StatusPillProps) => {
  const classes = [
    'inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide',
    toneMap[tone],
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={classes} {...props}>
      {children}
    </span>
  );
};

export default StatusPill;
