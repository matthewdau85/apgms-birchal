import React from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { navigation } from './navigation';

export function AppSidebar() {
  return (
    <aside
      className="hidden w-64 shrink-0 border-r border-slate-200 bg-white px-5 py-6 dark:border-slate-800 dark:bg-slate-900 lg:block"
      aria-label="Primary"
    >
      <div className="mb-8 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 font-semibold text-white">B</span>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">Birchal</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">Accounts platform</span>
        </div>
      </div>
      <nav>
        <ul className="space-y-1">
          {navigation.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500',
                    isActive
                      ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-200'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
                  )
                }
              >
                <span>{item.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
