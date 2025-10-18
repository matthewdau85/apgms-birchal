import React from 'react';
import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { Drawer } from '../ui/Drawer';
import { navigation } from './navigation';

type MobileSidebarProps = {
  open: boolean;
  onClose: () => void;
};

export function MobileSidebar({ open, onClose }: MobileSidebarProps) {
  return (
    <Drawer
      title="Navigation"
      description="Choose a destination."
      open={open}
      onClose={onClose}
      side="left"
    >
      <nav aria-label="Mobile">
        <ul className="space-y-2">
          {navigation.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'block rounded-md px-3 py-2 text-base font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500',
                    isActive
                      ? 'bg-indigo-500 text-white'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                  )
                }
                onClick={onClose}
              >
                {item.name}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </Drawer>
  );
}
