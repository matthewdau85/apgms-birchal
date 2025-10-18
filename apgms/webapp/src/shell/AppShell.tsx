import { Link, useRouterState } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'theme';

function resolveInitialTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }

  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [theme, setTheme] = useState<Theme>(() => resolveInitialTheme());

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    document.body.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const navItems = useMemo(
    () => [
      { label: 'Dashboard', to: '/' },
      { label: 'Bank lines', to: '/bank-lines' }
    ],
    []
  );

  const toggleTheme = () => {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'));
  };

  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900 transition dark:bg-slate-950 dark:text-slate-100">
      <a
        href="#main-content"
        className="absolute left-4 top-4 z-50 -translate-y-full rounded bg-primary-600 px-4 py-2 font-medium text-white focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-primary-400"
      >
        Skip to content
      </a>
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white/80 px-6 py-8 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 lg:flex">
        <div className="text-lg font-semibold tracking-tight">APGMS Console</div>
        <nav aria-label="Primary" className="mt-8 flex flex-1 flex-col gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`rounded-md px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${
                  isActive
                    ? 'bg-primary-600 text-white shadow-sm dark:bg-primary-500'
                    : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <p className="mt-auto text-xs text-slate-400 dark:text-slate-500">&copy; {new Date().getFullYear()} APGMS</p>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex items-center gap-3 lg:hidden">
            <span className="text-sm font-semibold">APGMS Console</span>
          </div>
          <div className="flex flex-1 items-center justify-end gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:focus-visible:ring-offset-slate-900"
              aria-pressed={theme === 'dark'}
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-xs text-white">
                {theme === 'dark' ? '🌙' : '☀️'}
              </span>
              <span className="hidden sm:inline">{theme === 'dark' ? 'Dark' : 'Light'} mode</span>
            </button>
          </div>
        </header>
        <main id="main-content" className="flex-1 overflow-y-auto bg-slate-50 px-4 py-6 dark:bg-slate-950">
          <div className="mx-auto flex h-full w-full max-w-6xl flex-col gap-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
