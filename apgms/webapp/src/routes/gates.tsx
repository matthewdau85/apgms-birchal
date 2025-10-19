import { useGates } from '../lib/hooks';
import { DateTime } from '../ui/DateTime';
import { Skeleton } from '../ui/Skeleton';
import { Empty } from '../ui/Empty';
import { ErrorState } from '../ui/Error';
import { cn } from '../utils/cn';

export const GatesRoute = () => {
  const { data, isLoading, isError, refetch } = useGates();
  const gates = data?.data ?? data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState onRetry={() => refetch()}>Unable to load gates.</ErrorState>;
  }

  if (!gates.length) {
    return <Empty>No gates configured at the moment.</Empty>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {gates.map((gate) => (
        <article
          key={gate.id}
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{gate.name}</h2>
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{gate.state}</p>
            </div>
            <span
              className={cn(
                'rounded-full px-2 py-1 text-xs font-medium',
                gate.state === 'OPEN'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200'
                  : gate.state === 'SCHEDULED'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200'
                  : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
              )}
            >
              {gate.state}
            </span>
          </div>
          <div className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">
            {gate.opensAt ? (
              <div>
                Opens <DateTime value={gate.opensAt} />
              </div>
            ) : null}
            {gate.closesAt ? (
              <div>
                Closes <DateTime value={gate.closesAt} />
              </div>
            ) : null}
            {gate.notes ? <p className="text-sm text-slate-500 dark:text-slate-400">{gate.notes}</p> : null}
          </div>
        </article>
      ))}
    </div>
  );
};

export default GatesRoute;
