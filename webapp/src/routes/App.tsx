import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { DashboardRoute } from './DashboardRoute';

const App = () => {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardRoute />} />
        <Route path="*" element={<div>Not Found</div>} />
      </Routes>
    </AppLayout>
  );
};

export default App;
