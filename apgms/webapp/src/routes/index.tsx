import { Navigate, createBrowserRouter } from 'react-router-dom';
import AuthLayout from '@/pages/auth/AuthLayout';
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import AtoLodgementPage from '@/pages/dashboard/AtoLodgementPage';
import BankLinesPage from '@/pages/dashboard/BankLinesPage';
import DashboardLayout from '@/pages/dashboard/DashboardLayout';
import OverviewPage from '@/pages/dashboard/OverviewPage';
import PaymentsApprovalsPage from '@/pages/dashboard/PaymentsApprovalsPage';
import ReconciliationPage from '@/pages/dashboard/ReconciliationPage';
import ProtectedRoute from './protected-route';

export const router = createBrowserRouter([
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      { index: true, element: <Navigate to="login" replace /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
    ],
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'bank-lines', element: <BankLinesPage /> },
      { path: 'reconciliation', element: <ReconciliationPage /> },
      { path: 'payments', element: <PaymentsApprovalsPage /> },
      { path: 'ato-lodgement', element: <AtoLodgementPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export default router;
