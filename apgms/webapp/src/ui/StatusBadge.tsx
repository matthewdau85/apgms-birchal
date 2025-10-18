import React from 'react';
import clsx from 'clsx';

const styles: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
  verified: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
  flagged: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200'
};

type StatusBadgeProps = {
  status: 'pending' | 'verified' | 'flagged';
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', styles[status])}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
