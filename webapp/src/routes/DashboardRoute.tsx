import { Suspense } from 'react';
import { DashboardView } from '../views/DashboardView';
import { ScreenLoadingState } from '../components/ui/ScreenLoadingState';

export const DashboardRoute = () => {
  return (
    <Suspense fallback={<ScreenLoadingState />}> 
      <DashboardView />
    </Suspense>
  );
};
