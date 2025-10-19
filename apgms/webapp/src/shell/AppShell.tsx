import { useEffect, useState, type ReactNode } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import clsx from 'clsx';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard' },
  { to: '/bank-lines', label: 'Bank lines' }
];

type Theme = 'light' | 'dark';

const resolveInitialTheme = (): Theme => {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const stored = window.localStorage.getItem('apgms:theme');
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }

  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
};

const applyTheme = (theme: Theme) => {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.dataset.theme = theme;
};

export const AppShell = ({ children }: { children: ReactNode }) => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(() => resolveInitialTheme());
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    applyTheme(theme);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('apgms:theme', theme);
    }
  }, [theme]);

  useEffect(() => {
    if (!mobileNavOpen) {
      return;
    }

    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileNavOpen(false);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mobileNavOpen]);

  const toggleTheme = () => {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'));
  };

  const closeOnNavigate = () => setMobileNavOpen(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-900 dark:text-slate-100">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <div className="flex min-h-screen">
        <aside
          className={clsx(
            'fixed inset-y-0 z-40 w-64 border-r border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 md:static md:translate-x-0 md:bg-white/95 md:dark:bg-slate-900/90',
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          )}
        >
          <div className="flex h-16 items-center justify-between px-6">
            <span className="text-lg font-semibold tracking-tight">Birchal Ops</span>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="rounded-md p-2 text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 md:hidden"
              aria-label="Close navigation"
            >
              <span aria-hidden>×</span>
            </button>
          </div>
          <nav aria-label="Primary" className="mt-4 space-y-1 px-2">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  prefetch="intent"
                  className={clsx(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500',
                    active
                      ? 'bg-sky-500 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/70'
                  )}
                  onClick={closeOnNavigate}
                >
                  <span aria-hidden className="text-base">
                    {item.label === 'Dashboard' ? '📊' : '🏦'}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/70 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
            <div className="flex h-16 items-center justify-between px-4 md:px-8">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(true)}
                  className="rounded-md p-2 text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 md:hidden"
                  aria-label="Open navigation"
                >
                  <span aria-hidden>☰</span>
                </button>
                <span className="text-base font-semibold text-slate-700 dark:text-slate-200">
                  Control centre
                </span>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                aria-pressed={theme === 'dark'}
                aria-label="Toggle color scheme"
              >
                <span aria-hidden>{theme === 'dark' ? '🌙' : '☀️'}</span>
                <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
              </button>
            </div>
          </header>
          <main id="main-content" className="flex-1 px-4 py-6 md:px-8 md:py-10" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm md:hidden"
          aria-hidden="true"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
    </div>
  );
};
