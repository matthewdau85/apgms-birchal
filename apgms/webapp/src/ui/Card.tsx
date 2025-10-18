import type { HTMLAttributes } from 'react';

function classNames(...values: Array<string | undefined | false>) {
  return values.filter(Boolean).join(' ');
}

type CardProps = HTMLAttributes<HTMLDivElement> & {
  intent?: 'default' | 'danger';
};

export function Card({ className, intent = 'default', ...props }: CardProps) {
  const intentClasses =
    intent === 'danger'
      ? 'border-rose-200 bg-rose-50/60 text-rose-900 dark:border-rose-900/40 dark:bg-rose-950/40 dark:text-rose-100'
      : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900';

  return (
    <div
      className={classNames(
        'rounded-xl border shadow-sm transition-colors focus-within:ring-2 focus-within:ring-primary-400 focus-within:ring-offset-2 dark:focus-within:ring-offset-slate-900',
        intentClasses,
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={classNames('flex flex-col gap-1 border-b border-slate-200 px-6 py-4 dark:border-slate-800', className)}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={classNames('text-base font-semibold leading-tight', className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={classNames('px-6 py-4 text-sm text-slate-700 dark:text-slate-300', className)} {...props} />;
}
