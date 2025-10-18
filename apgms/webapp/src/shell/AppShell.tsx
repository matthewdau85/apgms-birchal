import { Link, useRouterState } from '@tanstack/react-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { clsx } from 'clsx';

const NAVIGATION = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/bank-lines', label: 'Bank Lines', icon: '🏦' },
];

const STORAGE_KEY = 'apgms-theme';

type Theme = 'light' | 'dark';

const getSystemTheme = (): Theme =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

export function AppShell({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') {
      return 'light';
    }
    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    return stored ?? getSystemTheme();
  });
  const routerState = useRouterState();

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleMedia = (event: MediaQueryListEvent) => {
      setTheme(event.matches ? 'dark' : 'light');
    };
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', handleMedia);
    return () => media.removeEventListener('change', handleMedia);
  }, []);

  const activePath = useMemo(() => routerState.location.pathname, [routerState.location.pathname]);

  return (
    <div className="flex h-full bg-slate-100 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white/90 p-6 backdrop-blur dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <div className="mb-10 text-2xl font-semibold text-brand-600 dark:text-brand-400">APGMS</div>
        <nav className="space-y-1">
          {NAVIGATION.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-brand-50 hover:text-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 dark:hover:bg-slate-800 dark:hover:text-brand-300 dark:focus-visible:ring-offset-slate-900',
                activePath === item.to &&
                  'bg-brand-100 text-brand-700 shadow-sm dark:bg-slate-800 dark:text-brand-300',
              )}
            >
              <span className="text-lg" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto text-xs text-slate-500 dark:text-slate-400">
          &copy; {new Date().getFullYear()} APGMS
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-4 border-b border-slate-200 bg-white/70 px-4 py-3 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            <span className="text-lg" aria-hidden>
              📁
            </span>
            Switch Org
          </button>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle theme={theme} onToggle={setTheme} />
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 shadow-inner transition hover:bg-brand-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 dark:bg-brand-900/40 dark:text-brand-200 dark:hover:bg-brand-900/60"
              aria-label="Account"
            >
              JD
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-slate-50 p-4 dark:bg-slate-950">
          <div className="mx-auto flex h-full max-w-6xl flex-col gap-6 lg:flex-row">
            <section className="flex-1 rounded-2xl border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
              {children}
            </section>
            <aside className="hidden w-80 shrink-0 flex-col gap-4 rounded-2xl border border-dashed border-slate-300 bg-white/60 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400 lg:flex">
              <h2 className="text-base font-semibold text-slate-700 dark:text-slate-200">Secondary Screen</h2>
              <p>
                Pin quick actions, upcoming settlements, or audit tasks here. This area stays visible while you work through
                records.
              </p>
              <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                <span className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">Alerts</span>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">3 reconciliations ready for review.</p>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}

type ThemeToggleProps = {
  theme: Theme;
  onToggle: (theme: Theme) => void;
};

function ThemeToggle({ theme, onToggle }: ThemeToggleProps) {
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={() => onToggle(isDark ? 'light' : 'dark')}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium shadow-sm transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
      aria-pressed={isDark}
      aria-label="Toggle theme"
    >
      <span className="text-lg" aria-hidden>
        {isDark ? '🌙' : '🌞'}
      </span>
      {isDark ? 'Dark' : 'Light'}
    </button>
  );
}
