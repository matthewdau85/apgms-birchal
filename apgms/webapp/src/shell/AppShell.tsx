import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

type Theme = 'light' | 'dark';

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getPreferredTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const stored = window.localStorage.getItem('app-theme');
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setThemeState] = useState<Theme>(getPreferredTheme);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem('app-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const root = document.documentElement;
    root.dataset.theme = theme;
    root.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
}

type NavItem = {
  label: string;
  to: string;
  exact?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/', exact: true },
  { label: 'Bank Lines', to: '/bank-lines' },
];

function navLinkClass(base: string, active: boolean) {
  return [
    base,
    active
      ? 'bg-indigo-600 text-white dark:bg-indigo-500'
      : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
  ]
    .filter(Boolean)
    .join(' ');
}

function useIsActive(item: NavItem) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  if (item.exact) {
    return pathname === item.to;
  }

  if (item.to === '/') {
    return pathname === '/';
  }

  return pathname === item.to || pathname.startsWith(`${item.to.replace(/\/$/, '')}/`);
}

type NavLinkItemProps = {
  item: NavItem;
  baseClassName: string;
};

function NavLinkItem({ item, baseClassName }: NavLinkItemProps) {
  const isActive = useIsActive(item);

  return (
    <Link
      to={item.to}
      preload="intent"
      className={navLinkClass(baseClassName, isActive)}
      aria-current={isActive ? 'page' : undefined}
    >
      {item.label}
    </Link>
  );
}

function AppShell() {
  const { theme, toggleTheme } = useTheme();
  const nextTheme = theme === 'light' ? 'dark' : 'light';

  return (
    <div
      data-theme={theme}
      className="flex min-h-screen flex-col bg-slate-100 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100"
    >
      <header className="border-b border-slate-200 bg-white/70 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">APGMS</span>
            <span className="hidden text-sm text-slate-500 dark:text-slate-400 sm:inline">
              Funding Intelligence
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label={`Switch to ${nextTheme} theme`}
              aria-pressed={theme === 'dark'}
            >
              <span aria-hidden="true">{theme === 'light' ? '🌞' : '🌙'}</span>
              <span className="hidden sm:inline">{theme === 'light' ? 'Light' : 'Dark'} mode</span>
            </button>
          </div>
        </div>
        <nav className="mx-auto mt-2 flex w-full max-w-6xl gap-2 px-4 pb-3 md:hidden" aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <NavLinkItem
              key={item.to}
              item={item}
              baseClassName="flex-1 rounded-md px-3 py-2 text-center text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
            />
          ))}
        </nav>
      </header>

      <div className="flex flex-1">
        <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-slate-50/80 px-4 py-6 dark:border-slate-800 dark:bg-slate-900/40 md:block">
          <nav className="flex flex-col gap-2" aria-label="Sidebar">
            {NAV_ITEMS.map((item) => (
              <NavLinkItem
                key={item.to}
                item={item}
                baseClassName="rounded-md px-3 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              />
            ))}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default AppShell;
