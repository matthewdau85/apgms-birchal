import { Outlet } from 'react-router-dom';
import Card from '@/components/ui/Card';

export const AuthLayout = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md">
        <Card
          header={<div className="text-center text-lg font-semibold text-blue-600">APGMS Access</div>}
          footer={<p className="text-center text-xs text-slate-400">Secure entry to the operational console</p>}
        >
          <Outlet />
        </Card>
      </div>
    </div>
  );
};

export default AuthLayout;
