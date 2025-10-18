import { NavLink, Route, Routes } from 'react-router-dom';
import { Home } from './Home';
import { OnboardingWizard } from './onboarding/OnboardingWizard';
import { DesignatedAccounts } from './DesignatedAccounts';
import { AllocationsGates } from './AllocationsGates';
import { ReconciliationAudit } from './ReconciliationAudit';
import { AnomalyInbox } from './AnomalyInbox';
import { Settings } from './Settings';
import { AppShell } from '../components/ui/app-shell';

const links = [
  { to: '/', label: 'Overview' },
  { to: '/onboarding', label: 'Onboarding' },
  { to: '/designated-accounts', label: 'Designated Accounts' },
  { to: '/allocations', label: 'Allocations & Gates' },
  { to: '/reconciliation', label: 'Reconciliation & Audit' },
  { to: '/anomalies', label: 'Anomaly Inbox' },
  { to: '/settings', label: 'Settings' }
];

export default function App() {
  return (
    <AppShell
      navigation={
        <nav aria-label="Main navigation">
          <ul className="nav-list">
            {links.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                  end={link.to === '/'}
                >
                  {link.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      }
    >
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/onboarding" element={<OnboardingWizard />} />
        <Route path="/designated-accounts" element={<DesignatedAccounts />} />
        <Route path="/allocations" element={<AllocationsGates />} />
        <Route path="/reconciliation" element={<ReconciliationAudit />} />
        <Route path="/anomalies" element={<AnomalyInbox />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </AppShell>
  );
}
