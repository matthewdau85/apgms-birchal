import { useCallback, useEffect, useState } from 'react';

type AsyncResult<T> = {
  data: T | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
};

type AsyncFunction<T> = () => Promise<T>;

export function useAsync<T>(asyncFn: AsyncFunction<T>): AsyncResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const reload = useCallback(() => setRefreshIndex((index) => index + 1), []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await asyncFn();
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [asyncFn, refreshIndex]);

  return { data, loading, error, reload };
}
