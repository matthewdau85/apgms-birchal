import { PropsWithChildren } from 'react';

export const Empty = ({ children }: PropsWithChildren) => (
  <div className="rounded border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
    {children ?? 'Nothing to show yet.'}
  </div>
);
