import { NavLink } from 'react-router-dom';
import clsx from 'clsx';

const links = [
  { to: '/onboarding', label: 'Onboarding' },
  { to: '/tax', label: 'Tax Workflows' },
  { to: '/compliance', label: 'Compliance' }
];

export const Sidebar = () => (
  <aside className="sidebar">
    <h1 className="sidebar__title">APGMS</h1>
    <nav className="sidebar__nav">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          className={({ isActive }) =>
            clsx('sidebar__link', { 'sidebar__link--active': isActive })
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  </aside>
);
