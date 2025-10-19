import { PropsWithChildren } from 'react';
import { cn } from '../utils/cn';

type ErrorProps = {
  onRetry?: () => void;
  className?: string;
} & PropsWithChildren;

export const ErrorState = ({ children, onRetry, className }: ErrorProps) => (
  <div
    role="alert"
    className={cn(
      'rounded border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200',
      className,
    )}
  >
    <div>{children ?? 'Something went wrong.'}</div>
    {onRetry ? (
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 inline-flex items-center rounded border border-rose-300 px-3 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100 dark:border-rose-700 dark:text-rose-200 dark:hover:bg-rose-900/60"
      >
        Try again
      </button>
    ) : null}
  </div>
);
