import type { ReactNode } from 'react';

export interface TopbarProps {
  title?: string;
  children?: ReactNode;
}

export const Topbar = ({ title, children }: TopbarProps) => {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <div>
        <p className="text-xs uppercase tracking-wider text-slate-400">Operational Dashboard</p>
        <h2 className="text-lg font-semibold text-slate-900">{title ?? 'Welcome back'}</h2>
      </div>
      <div className="flex items-center gap-4">{children}</div>
    </div>
  );
};

export default Topbar;
