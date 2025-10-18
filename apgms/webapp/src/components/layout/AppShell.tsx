import type { ReactNode } from 'react';

export interface AppShellProps {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
}

export const AppShell = ({ sidebar, topbar, children }: AppShellProps) => {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-64 border-r border-slate-200 bg-white lg:block">{sidebar}</aside>
      <div className="flex-1">
        <header className="border-b border-slate-200 bg-white">{topbar}</header>
        <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
};

export default AppShell;
