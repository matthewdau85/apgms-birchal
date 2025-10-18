import { Dialog, Transition } from '@headlessui/react';
import { Fragment, ReactNode, useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';

type AppShellProps = {
  children: ReactNode;
};

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/bank-lines', label: 'Bank Lines' }
];

const getInitialTheme = () => {
  if (typeof window === 'undefined') return 'light';
  const stored = window.localStorage.getItem('app-theme');
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export default function AppShell({ children }: AppShellProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
    window.localStorage.setItem('app-theme', theme);
  }, [theme]);

  const themeIcon = useMemo(() => {
    return theme === 'dark' ? (
      <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M17.293 13.293a8 8 0 01-10.586-10.586A1 1 0 005 4a7 7 0 109 9 1 1 0 003.293.293z" />
      </svg>
    ) : (
      <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4.22 1.47a1 1 0 011.415 1.415l-.708.708a1 1 0 11-1.414-1.414l.707-.709zM17 9a1 1 0 110 2h-1a1 1 0 110-2h1zM5 10a1 1 0 10-2 0 1 1 0 002 0zm-.925-6.53a1 1 0 011.414 0l.708.707A1 1 0 015.783 5.59l-.708-.707a1 1 0 010-1.414zM10 15a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm6.364-1.95a1 1 0 00-1.414 0l-.707.708a1 1 0 101.414 1.414l.707-.707a1 1 0 000-1.415zM4.343 14.05a1 1 0 00-1.414 1.415l.707.707a1 1 0 101.415-1.414l-.708-.708z" />
        <path d="M10 5a5 5 0 100 10A5 5 0 0010 5z" />
      </svg>
    );
  }, [theme]);

  return (
    <div className="flex min-h-screen bg-surface-light/60 text-slate-900 transition-colors dark:bg-slate-950/60 dark:text-slate-100">
      <Transition.Root show={mobileOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50 lg:hidden" onClose={setMobileOpen}>
          <Transition.Child
            as={Fragment}
            enter="duration-150 ease-out"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="duration-150 ease-in"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/50" />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition duration-200 ease-out"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition duration-150 ease-in"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative flex w-72 max-w-full flex-col gap-6 overflow-y-auto bg-white p-6 shadow-xl dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">APGMS</span>
                  <button
                    type="button"
                    className="rounded-full p-2 text-slate-500 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:text-slate-300 dark:hover:text-white"
                    onClick={() => setMobileOpen(false)}
                  >
                    <span className="sr-only">Close navigation</span>
                    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
                <nav className="flex flex-col gap-2">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        `rounded-md px-3 py-2 text-sm font-medium hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-slate-800 ${
                          isActive
                            ? 'bg-brand-100 text-brand-700 dark:bg-slate-800 dark:text-brand-300'
                            : 'text-slate-600 dark:text-slate-300'
                        }`
                      }
                      onClick={() => setMobileOpen(false)}
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </nav>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      <aside className="relative hidden w-72 flex-col border-r border-slate-200 bg-white/80 px-6 py-8 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 lg:flex">
        <div className="mb-10 text-xl font-semibold tracking-tight text-brand-600 dark:text-brand-300">
          APGMS Console
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-100 text-brand-700 dark:bg-slate-800 dark:text-brand-300'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <p className="mt-12 text-xs text-slate-400 dark:text-slate-500">Secure banking insights</p>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/70 px-4 py-4 backdrop-blur dark:border-slate-800/60 dark:bg-slate-900/70 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white lg:hidden"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation"
              >
                <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M3 6a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 14a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
                </svg>
              </button>
              <div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Operations</p>
                <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Banking Overview</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {themeIcon}
                <span>{theme === 'dark' ? 'Dark' : 'Light'} mode</span>
              </button>
              <div className="hidden items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:flex">
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
                Status: Operational
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 bg-surface-light/70 px-4 py-8 dark:bg-slate-950/70 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
