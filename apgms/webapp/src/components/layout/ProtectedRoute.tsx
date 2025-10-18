import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';

import { useAppStore } from '../../store/appStore';

export const ProtectedRoute = () => {
  const location = useLocation();
  const { isAuthenticated, bootstrap } = useAppStore((state) => ({
    isAuthenticated: state.isAuthenticated,
    bootstrap: state.bootstrap
  }));

  useEffect(() => {
    bootstrap().catch(() => {
      /* handled by store */
    });
  }, [bootstrap]);

  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};
