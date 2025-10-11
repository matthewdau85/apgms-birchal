import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppProviders } from '@/providers/AppProviders';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardPage } from '@/pages/DashboardPage';
import { BasWorkspacePage } from '@/pages/BasWorkspacePage';
import { ReconCenterPage } from '@/pages/ReconCenterPage';
import { EvidenceAuditPage } from '@/pages/EvidenceAuditPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { OnboardingWizardPage } from '@/pages/OnboardingWizardPage';
import { DEFAULT_ONBOARDING_STEP } from '@/routes/config';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/bas-workspace" element={<BasWorkspacePage />} />
      <Route path="/recon-center" element={<ReconCenterPage />} />
      <Route path="/evidence-audit" element={<EvidenceAuditPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/onboarding" element={<Navigate to={`/onboarding/${DEFAULT_ONBOARDING_STEP}`} replace />} />
      <Route path="/onboarding/:stepId" element={<OnboardingWizardPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <AppShell>
          <AppRoutes />
        </AppShell>
      </BrowserRouter>
    </AppProviders>
  );
}
