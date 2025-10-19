import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes, useLocation } from 'react-router-dom';
import BankLines from './routes/bank-lines';
import Dashboard from './routes/index';

type Theme = 'light' | 'dark';

type NavItem = {
  path: string;
  label: string;
};

const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Dashboard' },
  { path: '/bank-lines', label: 'Bank lines' },
];

function usePreferredTheme(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

function useCurrentPath(): string {
  const location = useLocation();
  return location.pathname;
}

function AppShell(): JSX.Element {
  const [theme, setTheme] = useState<Theme>(() => usePreferredTheme());
  const currentPath = useCurrentPath();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const navigation = useMemo(
    () =>
      NAV_ITEMS.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          aria-current={currentPath === item.path ? 'page' : undefined}
        >
          {item.label}
        </Link>
      )),
    [currentPath],
  );

  return (
    <div className={`app-shell app-shell--${theme}`}>
      <header className="app-shell__header">
        <nav aria-label="Primary navigation">{navigation}</nav>
        <button
          type="button"
          onClick={() => setTheme((value) => (value === 'light' ? 'dark' : 'light'))}
        >
          Switch to {theme === 'light' ? 'dark' : 'light'} theme
        </button>
      </header>
      <main className="app-shell__content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/bank-lines" element={<BankLines />} />
        </Routes>
      </main>
    </div>
  );
}

function App(): JSX.Element {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

const container = document.getElementById('root');

if (container) {
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
