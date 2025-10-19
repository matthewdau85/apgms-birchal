import React from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { useTheme } from './theme';
import DashboardPage from './pages/DashboardPage';
import BankLinesPage from './pages/BankLinesPage';
import OnboardingPage from './pages/OnboardingPage';

const App: React.FC = () => {
  const { mode, toggle } = useTheme();

  return (
    <div className="app-shell">
      <nav className="app-nav" aria-label="Main navigation">
        <h1>Birchal Treasury</h1>
        <div className="nav-links">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : undefined)}>
            Dashboard
          </NavLink>
          <NavLink to="/bank-lines" className={({ isActive }) => (isActive ? 'active' : undefined)}>
            Bank Lines
          </NavLink>
          <NavLink to="/onboarding" className={({ isActive }) => (isActive ? 'active' : undefined)}>
            Onboarding
          </NavLink>
        </div>
        <button type="button" className="theme-toggle" onClick={toggle} aria-label="Toggle color theme">
          <span aria-hidden>{mode === 'light' ? '🌞' : '🌛'}</span>
          <span>{mode === 'light' ? 'Light' : 'Dark'} theme</span>
        </button>
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/bank-lines" element={<BankLinesPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
        </Routes>
      </main>
    </div>
  );
};

export default App;
