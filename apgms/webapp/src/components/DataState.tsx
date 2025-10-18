import { ReactNode } from 'react';

interface DataStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: 'default' | 'error';
}

export const DataState = ({ title, description, action, tone = 'default' }: DataStateProps) => {
  return (
    <div
      className={`rounded-lg border ${
        tone === 'error'
          ? 'border-red-200 bg-red-50/70 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200'
          : 'border-slate-200 bg-white/60 text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300'
      } p-6 text-center`}
    >
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? <p className="mt-2 text-sm leading-relaxed">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
};
