import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from './client';
import type {
  AtoLodgement,
  BankLine,
  DashboardSummary,
  PaymentApproval,
  ReconciliationTask,
} from './types';

export interface ApiQueryState<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useApiQuery = <T>(fetcher: () => Promise<T>, deps: unknown[] = []): ApiQueryState<T> => {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const execute = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetcher();
      if (!mountedRef.current) {
        return;
      }
      setData(response);
    } catch (err) {
      if (!mountedRef.current) {
        return;
      }
      const message = err instanceof Error ? err : new Error('Unknown error');
      setError(message);
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, deps);

  useEffect(() => {
    execute();
  }, [execute]);

  return useMemo(
    () => ({
      data,
      isLoading,
      error,
      refetch: execute,
    }),
    [data, error, execute, isLoading]
  );
};

export const useDashboardSummary = () =>
  useApiQuery(() => apiClient.get<DashboardSummary>('/dashboard/summary'), []);

export const useBankLines = () => useApiQuery(() => apiClient.get<BankLine[]>('/bank-lines'), []);

export const useReconciliationWorkflow = () =>
  useApiQuery(() => apiClient.get<ReconciliationTask[]>('/reconciliation'), []);

export const usePaymentsApprovals = () =>
  useApiQuery(() => apiClient.get<PaymentApproval[]>('/payments/approvals'), []);

export const useAtoLodgementStatus = () =>
  useApiQuery(() => apiClient.get<AtoLodgement[]>('/ato/status'), []);
