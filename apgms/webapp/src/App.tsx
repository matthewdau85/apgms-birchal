import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import ApplicationBuilderPage from './pages/ApplicationBuilderPage';
import PriorArtSearchPage from './pages/PriorArtSearchPage';
import CollaborationSuitePage from './pages/CollaborationSuitePage';
import PortfolioInsightsPage from './pages/PortfolioInsightsPage';

const App: React.FC = () => {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/application-builder" element={<ApplicationBuilderPage />} />
        <Route path="/prior-art" element={<PriorArtSearchPage />} />
        <Route path="/collaboration" element={<CollaborationSuitePage />} />
        <Route path="/portfolio" element={<PortfolioInsightsPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
};

export default App;
