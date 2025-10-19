import { Link, useRouterState } from '@tanstack/react-router';
import { Menu, Moon, Sun } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTheme } from '../theme/theme-provider';
import { clsx } from 'clsx';

const navigation = [
  { label: 'Dashboard', to: '/' },
  { label: 'Bank Lines', to: '/bank-lines' }
];

export function AppShell({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-20 bg-slate-950/40 lg:hidden"
          onClick={closeSidebar}
        />
      ) : null}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-30 w-64 transform bg-white shadow-lg transition-transform dark:bg-slate-900 lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex h-16 items-center justify-center border-b border-slate-200 px-4 dark:border-slate-700">
          <span className="text-lg font-semibold text-slate-900 dark:text-slate-100">APGMS</span>
        </div>
        <nav className="flex flex-col gap-1 p-4" aria-label="Main navigation">
          {navigation.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={closeSidebar}
              activeProps={{ 'aria-current': 'page' }}
              className={({ isActive }) =>
                clsx(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                )
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-slate-300 dark:hover:bg-slate-800 lg:hidden"
              onClick={() => setSidebarOpen((prev) => !prev)}
              aria-label="Toggle navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {navigation.find((item) => item.to === pathname)?.label ?? 'APGMS'}
            </span>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            <span className="hidden sm:inline">{theme === 'light' ? 'Light' : 'Dark'}</span>
          </button>
        </header>
        <main className="flex-1 bg-slate-50 p-6 dark:bg-slate-950">
          <div className="mx-auto max-w-6xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
