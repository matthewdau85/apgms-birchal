import type { HTMLAttributes } from 'react';

type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  animate?: boolean;
};

export function Skeleton({ className = 'h-4 w-full', animate = true, ...rest }: SkeletonProps) {
  const classes = [
    'rounded-md',
    'bg-slate-200',
    'dark:bg-slate-700',
    animate ? 'animate-pulse' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={classes} aria-hidden="true" {...rest} />;
}

export default Skeleton;
