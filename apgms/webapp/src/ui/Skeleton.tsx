import { HTMLAttributes } from 'react';

export const Skeleton = ({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={`animate-pulse rounded-md bg-slate-200/70 dark:bg-slate-700/50 ${className}`}
    {...props}
  />
);
