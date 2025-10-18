import React from 'react';
import { NavLink } from 'react-router-dom';

type LayoutProps = {
  children: React.ReactNode;
};

const navigation = [
  { to: '/dashboard', label: 'Patent cockpit' },
  { to: '/application-builder', label: 'Application builder' },
  { to: '/prior-art', label: 'Prior art intelligence' },
  { to: '/collaboration', label: 'Collaboration suite' },
  { to: '/portfolio', label: 'Portfolio insights' },
];

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <div className="app-shell__logo">Astra Patent Studio</div>

        <div className="nav-section">
          <span className="nav-section__label">Workspace</span>
          <nav className="nav-links">
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  ['nav-link', isActive ? 'active' : ''].filter(Boolean).join(' ')
                }
              >
                <span role="img" aria-label="compass">
                  🧭
                </span>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="nav-section">
          <span className="nav-section__label">Active dossier</span>
          <div className="section-card">
            <div>
              <div className="tag">
                <span className="status-dot" />
                Filing Q4 2024
              </div>
              <h3 style={{ marginBottom: 4 }}>Autonomous Greenhouse Mesh</h3>
              <p style={{ margin: 0, color: 'rgba(248, 250, 252, 0.7)' }}>
                Utility patent · Ref. PCT/US-24/01987
              </p>
            </div>
            <button className="secondary-button" type="button">
              Export dossier
            </button>
          </div>
        </div>
      </aside>

      <main className="app-shell__content">{children}</main>
    </div>
  );
};

export default Layout;
