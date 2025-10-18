import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { useMemo } from 'react';

import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/cn';

const navigation = [
  { href: '/', label: 'Dashboard' },
  { href: '/bank-lines', label: 'Bank Lines' },
];

const ThemeToggleIcon = ({ theme }: { theme: 'light' | 'dark' }) => {
  if (theme === 'dark') {
    return (
      <svg aria-hidden="true" className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
        <path d="M17.293 13.293a8 8 0 01-10.586-10.586A8 8 0 1017.293 13.293z" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
      <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-4 7a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM4.222 4.222a1 1 0 011.414 0L6.343 4.93a1 1 0 11-1.414 1.414L4.222 5.636a1 1 0 010-1.414zM17 9a1 1 0 100 2h1a1 1 0 100-2h-1zm-2.95-4.071a1 1 0 011.414-1.414l.707.708a1 1 0 11-1.414 1.414l-.707-.708zM4 10a1 1 0 01-1 1H2a1 1 0 110-2h1a1 1 0 011 1zm11.778 5.778a1 1 0 00-1.414-1.414l-.707.708a1 1 0 001.414 1.414l.707-.708zM6.343 15.07a1 1 0 00-1.414 1.415l.707.707a1 1 0 001.414-1.414l-.707-.708z" />
    </svg>
  );
};

const AppShell = () => {
  const routerState = useRouterState({ select: (state) => state.location.pathname });
  const { theme, toggleTheme } = useTheme();

  const activeHref = useMemo(() => routerState, [routerState]);

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white/80 px-4 py-6 backdrop-blur dark:border-slate-800 dark:bg-slate-900/60 lg:flex">
        <div className="flex items-center gap-2 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-brand-foreground font-semibold">AP</span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">APGMS</p>
            <p className="text-base font-semibold text-slate-900 dark:text-slate-100">Operations</p>
          </div>
        </div>
        <nav aria-label="Primary" className="mt-8 flex flex-1 flex-col gap-1">
          {navigation.map((item) => {
            const isActive = activeHref === item.href;

            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
                  isActive
                    ? 'bg-brand text-brand-foreground shadow-subtle dark:shadow-none'
                    : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm dark:border-slate-800">
          <span className="font-medium text-slate-600 dark:text-slate-300">Theme</span>
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-2 rounded-md border border-transparent bg-slate-900 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            <ThemeToggleIcon theme={theme} />
            <span className="hidden sm:inline">{theme === 'dark' ? 'Dark' : 'Light'}</span>
          </button>
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand text-base font-semibold uppercase text-brand-foreground">
              AP
            </span>
            <div className="leading-tight">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">APGMS</p>
              <p className="text-base font-semibold">Operations Portal</p>
            </div>
          </div>
          <nav aria-label="Mobile" className="flex items-center gap-1 lg:hidden">
            {navigation.map((item) => {
              const isActive = activeHref === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
                    isActive
                      ? 'bg-brand text-brand-foreground'
                      : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
          >
            <ThemeToggleIcon theme={theme} />
            <span className="sr-only">Toggle theme</span>
          </button>
        </header>
        <main id="main-content" className="flex-1 overflow-y-auto bg-slate-50 px-4 py-6 dark:bg-slate-950">
          <div className="mx-auto w-full max-w-6xl space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AppShell;
