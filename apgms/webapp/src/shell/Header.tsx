import React from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme } from './ThemeProvider';
import { navigation } from './navigation';

const routeTitles: Record<string, string> = Object.fromEntries(navigation.map((item) => [item.to, item.name]));

type AppHeaderProps = {
  onToggleMobileNav: () => void;
};

export function AppHeader({ onToggleMobileNav }: AppHeaderProps) {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const title = routeTitles[location.pathname] ?? 'Overview';

  return (
    <header
      className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 sm:px-6"
      role="banner"
    >
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-transparent text-slate-600 transition hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:text-slate-300 dark:hover:text-white lg:hidden"
          onClick={onToggleMobileNav}
        >
          <span className="sr-only">Open navigation</span>
          <MenuIcon aria-hidden="true" className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Real-time financial visibility for Birchal operations.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <ThemeToggleButton theme={theme} onToggle={toggleTheme} />
      </div>
    </header>
  );
}

function ThemeToggleButton({
  theme,
  onToggle
}: {
  theme: 'light' | 'dark';
  onToggle: () => void;
}) {
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={theme === 'dark'}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700"
    >
      <span className="sr-only">{label}</span>
      {theme === 'dark' ? (
        <MoonIcon aria-hidden="true" className="h-5 w-5" />
      ) : (
        <SunIcon aria-hidden="true" className="h-5 w-5" />
      )}
      <span aria-hidden="true">{theme === 'dark' ? 'Dark' : 'Light'}</span>
    </button>
  );
}

function SunIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2m10-10h-2M4 12H2m16.95 6.95-1.41-1.41M6.46 6.46 5.05 5.05m12.9 0-1.41 1.41M6.46 17.54 5.05 18.95" />
    </svg>
  );
}

function MoonIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M21 12.79A9 9 0 0 1 11.21 3 7 7 0 1 0 21 12.79z" />
    </svg>
  );
}

function MenuIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
