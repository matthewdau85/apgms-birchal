import { cn } from '../utils/cn';

type SkeletonProps = {
  className?: string;
};

export const Skeleton = ({ className }: SkeletonProps) => (
  <div className={cn('animate-pulse rounded bg-slate-200 dark:bg-slate-700', className)} />
);
