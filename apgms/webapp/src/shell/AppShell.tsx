import { PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';

type Theme = 'light' | 'dark';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/bank-lines', label: 'Bank Lines' }
] as const;

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const stored = window.localStorage.getItem('theme');
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function AppShell({ children }: PropsWithChildren): JSX.Element {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.add('light');
    }
    root.style.colorScheme = theme;
    window.localStorage.setItem('theme', theme);
  }, [theme]);

  const navLinks = useMemo(
    () =>
      NAV_ITEMS.map((item) => (
        <li key={item.to}>
          <NavLink
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`
            }
          >
            <span aria-hidden="true">•</span>
            <span>{item.label}</span>
          </NavLink>
        </li>
      )),
    []
  );

  const toggleTheme = () => setTheme((current) => (current === 'light' ? 'dark' : 'light'));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className="hidden w-64 shrink-0 border-b border-r border-border bg-card md:flex md:flex-col">
          <div className="border-b border-border px-6 py-5">
            <p className="text-lg font-semibold text-card-foreground">APGMS</p>
            <p className="text-sm text-muted-foreground">Financial Oversight</p>
          </div>
          <nav aria-label="Primary" className="flex-1 overflow-y-auto px-4 py-6">
            <ul className="space-y-1 list-none">{navLinks}</ul>
          </nav>
        </aside>
        <div className="flex flex-1 flex-col">
          <header className="flex flex-col gap-4 border-b border-border bg-card px-4 py-4 shadow-sm md:flex-row md:items-center md:justify-between md:px-6">
            <div>
              <p className="text-base font-semibold text-card-foreground">APGMS Platform</p>
              <p className="text-sm text-muted-foreground">
                Monitor KPIs and manage your bank line verifications.
              </p>
            </div>
            <div className="flex items-center justify-between gap-4 md:justify-end">
              <nav aria-label="Primary" className="md:hidden">
                <ul className="flex items-center gap-2 list-none">{navLinks}</ul>
              </nav>
              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-card-foreground shadow-sm transition-colors hover:bg-muted"
                aria-pressed={theme === 'dark'}
                aria-label={theme === 'dark' ? 'Activate light theme' : 'Activate dark theme'}
              >
                <ThemeIcon theme={theme} />
                <span>{theme === 'dark' ? 'Dark' : 'Light'} mode</span>
              </button>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto bg-background px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

function ThemeIcon({ theme }: { theme: Theme }) {
  if (theme === 'dark') {
    return (
      <svg
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        className="h-4 w-4 fill-current"
      >
        <path d="M12 18a6 6 0 0 0 0-12v12Zm0 4a10 10 0 0 1 0-20 1 1 0 0 1 .8 1.6A8 8 0 0 0 20.4 14a1 1 0 0 1-1.6.8A10 10 0 0 1 12 22Z" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
      <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Zm0 4a1 1 0 0 1-1-1v-1a1 1 0 1 1 2 0v1a1 1 0 0 1-1 1Zm0-18a1 1 0 0 1-1-1V2a1 1 0 1 1 2 0v1a1 1 0 0 1-1 1Zm10 7h-1a1 1 0 1 1 0-2h1a1 1 0 1 1 0 2Zm-18 0H3a1 1 0 0 1 0-2h1a1 1 0 1 1 0 2Zm15.07 9.07a1 1 0 0 1-1.41 0l-.71-.7a1 1 0 1 1 1.41-1.42l.71.71a1 1 0 0 1 0 1.41Zm-12.02 0a1 1 0 0 1-1.41-1.41l.71-.71a1 1 0 0 1 1.41 1.42l-.71.7Zm0-16.14a1 1 0 0 1 0-1.41l.71-.71a1 1 0 0 1 1.41 1.41l-.71.71a1 1 0 0 1-1.41 0Zm12.02 0-.7-.71a1 1 0 0 1 1.41-1.41l.71.71a1 1 0 0 1-1.42 1.41Z" />
    </svg>
  );
}

export default AppShell;
