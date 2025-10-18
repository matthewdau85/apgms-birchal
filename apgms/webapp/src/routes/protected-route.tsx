import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/state/authStore';
import type { ReactNode } from 'react';

export interface ProtectedRouteProps {
  children: ReactNode;
}

export const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const location = useLocation();
  const { user } = useAuthStore((state) => ({ user: state.user }));

  if (!user) {
    return <Navigate to="/auth/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
