import { Link, useRouterState } from '@tanstack/react-router';
import { ReactNode } from 'react';

const navigation = [
  { label: 'Dashboard', to: '/' },
  { label: 'Bank Lines', to: '/bank-lines' }
];

type AppShellProps = {
  children: ReactNode;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
};

export function AppShell({ children, theme, onToggleTheme }: AppShellProps) {
  const routerState = useRouterState();
  return (
    <div className="flex h-full bg-gray-50 text-gray-900 transition-colors dark:bg-gray-950 dark:text-gray-100">
      <aside className="hidden w-64 flex-col border-r border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900 lg:flex">
        <div className="mb-8">
          <span className="text-xl font-semibold text-brand-600 dark:text-brand-400">APGMS</span>
          <p className="text-sm text-gray-500 dark:text-gray-400">Payments Governance</p>
        </div>
        <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-2">
          {navigation.map((item) => {
            const isActive = routerState.location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-label={item.label}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
                  isActive
                    ? 'bg-brand-100 text-brand-700 dark:bg-brand-700/20 dark:text-brand-200'
                    : 'text-gray-600 hover:bg-brand-50 hover:text-brand-600 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
                activeOptions={{ exact: true }}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-brand-500 hover:text-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            onClick={onToggleTheme}
            aria-label="Toggle theme"
          >
            <span aria-hidden="true">{theme === 'dark' ? '🌙' : '☀️'}</span>
            <span>{theme === 'dark' ? 'Dark' : 'Light'} mode</span>
          </button>
        </header>
        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 dark:bg-gray-950">
          <div className="mx-auto flex max-w-6xl flex-col gap-6" aria-live="polite">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
