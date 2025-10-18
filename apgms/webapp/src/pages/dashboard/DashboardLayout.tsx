import { Outlet, useNavigate } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/layout/PageHeader';
import Sidebar from '@/components/navigation/Sidebar';
import Topbar from '@/components/navigation/Topbar';
import Button from '@/components/ui/Button';
import { useAuthStore } from '@/state/authStore';

const navItems = [
  { label: 'Overview', to: '/' },
  { label: 'Bank lines', to: '/bank-lines' },
  { label: 'Reconciliation', to: '/reconciliation' },
  { label: 'Payments', to: '/payments' },
  { label: 'ATO lodgement', to: '/ato-lodgement' },
];

export const DashboardLayout = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore((state) => ({
    user: state.user,
    logout: state.logout,
  }));

  const handleLogout = () => {
    logout();
    navigate('/auth/login');
  };

  return (
    <AppShell
      sidebar={<Sidebar items={navItems} />}
      topbar={
        <Topbar title="Birchal operator console">
          <div className="flex flex-col text-right">
            <span className="text-sm font-medium text-slate-900">{user?.name ?? 'Unknown user'}</span>
            <span className="text-xs text-slate-500">{user?.email}</span>
          </div>
          <Button variant="ghost" onClick={handleLogout}>
            Sign out
          </Button>
        </Topbar>
      }
    >
      <PageHeader
        title="Operational dashboard"
        description="Monitor bank lines, reconciliations, payments approvals and ATO obligations in one workspace."
      />
      <Outlet />
    </AppShell>
  );
};

export default DashboardLayout;
