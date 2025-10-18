import { NavLink } from 'react-router-dom';

export interface SidebarItem {
  label: string;
  to: string;
  icon?: string;
}

export interface SidebarProps {
  items: SidebarItem[];
}

export const Sidebar = ({ items }: SidebarProps) => {
  return (
    <nav className="flex h-full flex-col justify-between">
      <div>
        <div className="px-6 py-4 text-lg font-semibold text-blue-600">APGMS Console</div>
        <ul className="space-y-1 px-2">
          {items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  [
                    'flex items-center gap-3 rounded-md px-4 py-2 text-sm font-medium text-slate-600 transition-colors',
                    isActive ? 'bg-blue-50 text-blue-600' : 'hover:bg-slate-100',
                  ]
                    .filter(Boolean)
                    .join(' ')
                }
              >
                {item.icon ? <span aria-hidden>{item.icon}</span> : null}
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
      <div className="px-4 pb-4 text-xs text-slate-400">© {new Date().getFullYear()} APGMS</div>
    </nav>
  );
};

export default Sidebar;
