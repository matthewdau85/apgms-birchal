import { useEffect, useState } from 'react';
import { DashboardData, fetchDashboardData } from '../data/dashboardData';

type DashboardState = {
  data: DashboardData | null;
  status: 'idle' | 'loading' | 'success' | 'error';
  error: Error | null;
};

const initialState: DashboardState = {
  data: null,
  status: 'idle',
  error: null
};

export const useDashboardData = () => {
  const [state, setState] = useState<DashboardState>(initialState);

  useEffect(() => {
    let active = true;
    setState((prev) => ({ ...prev, status: 'loading', error: null }));
    fetchDashboardData()
      .then((data) => {
        if (!active) return;
        setState({ data, status: 'success', error: null });
      })
      .catch((error: Error) => {
        if (!active) return;
        setState({ data: null, status: 'error', error });
      });
    return () => {
      active = false;
    };
  }, []);

  return state;
};
