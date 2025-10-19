import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useRouterState } from '@tanstack/react-router';

const ThemeContext = createContext<{ theme: 'light' | 'dark'; toggle: () => void }>({
  theme: 'light',
  toggle: () => undefined,
});

const getPreferredTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem('apgms-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  return 'light';
};

export const ThemeProvider = ({ children }: PropsWithChildren) => {
  const [theme, setTheme] = useState<'light' | 'dark'>(getPreferredTheme);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('apgms-theme', theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      toggle: () => setTheme((current) => (current === 'light' ? 'dark' : 'light')),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/bank-lines', label: 'Bank Lines' },
  { to: '/policies', label: 'Policies' },
  { to: '/gates', label: 'Gates' },
  { to: '/audit', label: 'Audit' },
];

const AppHeader = () => {
  const { theme, toggle } = useTheme();
  const router = useRouterState();
  const activeTitle = useMemo(() => {
    const active = navItems.find((item) =>
      item.to === '/'
        ? router.location.pathname === '/'
        : router.location.pathname.startsWith(item.to),
    );
    return active?.label ?? 'Overview';
  }, [router.location.pathname]);

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{activeTitle}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Credit risk posture at a glance</p>
      </div>
      <button
        type="button"
        onClick={toggle}
        className="inline-flex items-center rounded border border-slate-300 px-3 py-1 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        aria-label="Toggle theme"
      >
        {theme === 'light' ? '🌞 Light' : '🌙 Dark'}
      </button>
    </header>
  );
};

export const AppShell = () => (
  <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white px-4 py-6 dark:border-slate-800 dark:bg-slate-900 md:flex">
      <div className="mb-8 text-2xl font-bold text-indigo-600 dark:text-indigo-400">APGMS</div>
      <nav className="space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `block rounded px-3 py-2 text-sm font-medium transition ${
                isActive
                  ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-200'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
              }`
            }
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
    <div className="flex flex-1 flex-col">
      <AppHeader />
      <main className="flex-1 px-4 py-6 md:px-8">
        <Outlet />
      </main>
    </div>
  </div>
);
