import React from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';

type Theme = 'light' | 'dark';

interface AppShellProps {
  initialTheme: Theme;
  storageKey: string;
}

const layoutStyles = `
  :root[data-theme='light'] .app-shell {
    --app-bg: #f8fafc;
    --app-fg: #0f172a;
    --app-panel: #ffffff;
    --app-border: rgba(15, 23, 42, 0.1);
    --app-muted: #64748b;
  }
  :root[data-theme='dark'] .app-shell {
    --app-bg: #0f172a;
    --app-fg: #e2e8f0;
    --app-panel: #1e293b;
    --app-border: rgba(148, 163, 184, 0.25);
    --app-muted: #94a3b8;
  }
  .app-shell {
    min-height: 100vh;
    background-color: var(--app-bg);
    color: var(--app-fg);
    font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
  }
  .app-shell__skip-link {
    position: absolute;
    left: -999px;
    top: 0.5rem;
    background: var(--app-panel);
    color: var(--app-fg);
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.15);
    z-index: 1000;
  }
  .app-shell__skip-link:focus {
    left: 0.75rem;
  }
  .focus-ring:focus-visible {
    outline: 3px solid currentColor;
    outline-offset: 3px;
  }
  .app-shell__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 1.5rem;
    background: var(--app-panel);
    border-bottom: 1px solid var(--app-border);
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .app-shell__brand {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .app-shell__brand-name {
    font-size: 1.125rem;
    font-weight: 600;
    letter-spacing: -0.01em;
  }
  .app-shell__brand-tagline {
    font-size: 0.875rem;
    color: var(--app-muted);
  }
  .app-shell__theme-toggle {
    border: 1px solid var(--app-border);
    background: transparent;
    color: inherit;
    padding: 0.5rem 0.85rem;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    cursor: pointer;
  }
  .app-shell__theme-toggle:hover {
    background: rgba(148, 163, 184, 0.08);
  }
  .app-shell__layout {
    display: flex;
    flex-direction: column;
    min-height: calc(100vh - 64px);
  }
  .app-shell__sidebar {
    background: var(--app-panel);
    border-bottom: 1px solid var(--app-border);
  }
  .app-shell__nav {
    display: flex;
    flex-direction: row;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
  }
  .app-shell__nav-link {
    display: inline-flex;
    align-items: center;
    justify-content: flex-start;
    gap: 0.5rem;
    padding: 0.65rem 0.9rem;
    border-radius: 0.75rem;
    font-size: 0.95rem;
    font-weight: 500;
    color: inherit;
    text-decoration: none;
  }
  .app-shell__nav-link:hover {
    background: rgba(148, 163, 184, 0.12);
  }
  .app-shell__nav-link--active {
    background: rgba(59, 130, 246, 0.18);
    color: #2563eb;
  }
  .app-shell__content {
    flex: 1;
    background: transparent;
  }
  .app-shell__main {
    min-height: 100%;
  }
  @media (min-width: 768px) {
    .app-shell__layout {
      flex-direction: row;
    }
    .app-shell__sidebar {
      width: 240px;
      border-right: 1px solid var(--app-border);
      border-bottom: none;
    }
    .app-shell__nav {
      flex-direction: column;
      gap: 0.25rem;
      padding: 1.25rem 1rem;
    }
    .app-shell__content {
      padding-left: 0;
    }
  }
`;

let stylesInjected = false;

const ensureStyles = () => {
  if (stylesInjected || typeof document === 'undefined') {
    return;
  }

  const style = document.createElement('style');
  style.setAttribute('data-app-shell-styles', 'true');
  style.textContent = layoutStyles;
  document.head.appendChild(style);
  stylesInjected = true;
};

const AppShell: React.FC<AppShellProps> = ({ initialTheme, storageKey }) => {
  const [theme, setTheme] = React.useState<Theme>(initialTheme);

  React.useEffect(() => {
    ensureStyles();
  }, []);

  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
    }
    if (typeof window !== 'undefined') {
      window.localStorage?.setItem(storageKey, theme);
    }
  }, [theme, storageKey]);

  React.useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      setTheme(event.matches ? 'dark' : 'light');
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  const navLinkClassName = React.useCallback(
    ({ isActive }: { isActive: boolean }) =>
      [
        'app-shell__nav-link',
        'focus-ring',
        isActive ? 'app-shell__nav-link--active' : undefined,
      ]
        .filter(Boolean)
        .join(' '),
    [],
  );

  const toggleTheme = () => {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'));
  };

  const themeLabel = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <div className="app-shell">
      <a className="app-shell__skip-link focus-ring" href="#main-content">
        Skip to main content
      </a>
      <header className="app-shell__header" role="banner">
        <Link to="/" className="focus-ring" style={{ textDecoration: 'none', color: 'inherit' }}>
          <span className="app-shell__brand">
            <span className="app-shell__brand-name">APGMS Console</span>
            <span className="app-shell__brand-tagline">Operational insights &amp; treasury tools</span>
          </span>
        </Link>
        <button
          type="button"
          className="app-shell__theme-toggle focus-ring"
          onClick={toggleTheme}
          aria-pressed={theme === 'dark'}
          aria-label={themeLabel}
        >
          <span aria-hidden="true">{theme === 'dark' ? '🌙' : '🌞'}</span>
          <span>{theme === 'dark' ? 'Dark' : 'Light'} mode</span>
        </button>
      </header>
      <div className="app-shell__layout">
        <aside className="app-shell__sidebar" role="complementary">
          <nav aria-label="Primary" className="app-shell__nav">
            <NavLink to="/" end className={navLinkClassName}>
              Overview
            </NavLink>
            <NavLink to="/bank-lines" className={navLinkClassName}>
              Bank lines
            </NavLink>
          </nav>
        </aside>
        <div className="app-shell__content">
          <main id="main-content" className="app-shell__main" role="main">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default AppShell;
