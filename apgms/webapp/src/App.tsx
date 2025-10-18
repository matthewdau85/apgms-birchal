import { Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from './components/layout/AppLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { ComplianceDashboardPage } from './pages/ComplianceDashboardPage';
import { LoginPage } from './pages/LoginPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { TaxWorkflowPage } from './pages/TaxWorkflowPage';
import { NotFoundPage } from './pages/NotFoundPage';

const App = () => (
  <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedRoute />}> 
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/onboarding" replace />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/tax" element={<TaxWorkflowPage />} />
        <Route path="/compliance" element={<ComplianceDashboardPage />} />
      </Route>
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </Routes>
);

export default App;
