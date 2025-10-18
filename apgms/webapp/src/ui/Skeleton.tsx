import { clsx } from 'clsx';

type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className }: SkeletonProps) {
  return <div className={clsx('animate-pulse rounded-md bg-slate-200/80 dark:bg-slate-700/60', className)} />;
}
