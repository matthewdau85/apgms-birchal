import React from 'react';
import clsx from 'clsx';

type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className }: SkeletonProps) {
  return <div className={clsx('animate-pulse rounded bg-slate-200 dark:bg-slate-700', className)} aria-hidden="true" />;
}
