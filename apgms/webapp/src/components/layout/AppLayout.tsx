import { Outlet } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';
import { ErrorBanner } from '../ui/ErrorBanner';
import { LoadingOverlay } from '../ui/LoadingOverlay';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export const AppLayout = () => {
  const { globalError, isBootstrapping } = useAppStore((state) => ({
    globalError: state.error,
    isBootstrapping: state.isBootstrapping
  }));

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-content">
        <TopBar />
        <main className="app-main">
          {globalError && <ErrorBanner message={globalError} />}
          <LoadingOverlay isLoading={isBootstrapping} />
          <Outlet />
        </main>
      </div>
    </div>
  );
};
