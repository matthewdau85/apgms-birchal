import { NavLink } from 'react-router-dom';
import { ThemeToggle } from '../ui/ThemeToggle';
import styles from './AppLayout.module.css';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/reports', label: 'Reports' }
];

export const AppLayout: React.FC<React.PropsWithChildren> = ({ children }) => {
  return (
    <div className={styles.appShell}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>APGMS</div>
        <nav aria-label="Primary">
          <ul className={styles.navList}>
            {NAV_ITEMS.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) => (isActive ? styles.navLinkActive : styles.navLink)}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className={styles.sidebarFooter}>
          <ThemeToggle />
        </div>
      </aside>
      <main className={styles.contentArea}>{children}</main>
    </div>
  );
};
