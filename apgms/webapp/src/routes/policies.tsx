import { useState } from 'react';
import { usePolicies } from '../lib/hooks';
import { Money } from '../ui/Money';
import { DateTime } from '../ui/DateTime';
import { Skeleton } from '../ui/Skeleton';
import { Empty } from '../ui/Empty';
import { ErrorState } from '../ui/Error';

export const PoliciesRoute = () => {
  const { data, isLoading, isError, refetch } = usePolicies();
  const policies = data?.data ?? data ?? [];
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }

  if (isError) {
    return <ErrorState onRetry={() => refetch()}>Unable to load policies.</ErrorState>;
  }

  if (!policies.length) {
    return <Empty>No policies are active yet.</Empty>;
  }

  return (
    <div className="space-y-4">
      {policies.map((policy) => {
        const isOpen = expanded === policy.id;
        return (
          <article
            key={policy.id}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{policy.reference}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">{policy.insuredParty}</p>
              </div>
              <div className="flex items-center gap-6 text-sm text-slate-600 dark:text-slate-300">
                <span>
                  Limit: <Money amount={policy.exposureLimit} />
                </span>
                <span>Coverage: {policy.coveragePercent}%</span>
                <span>
                  Effective <DateTime value={policy.effectiveFrom} variant="date" />
                </span>
              </div>
            </div>

            {policy.rulesSummary ? (
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{policy.rulesSummary}</p>
            ) : null}

            <div className="mt-4 space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <div>
                <span className="font-medium text-slate-600 dark:text-slate-300">Coverage window:</span>{' '}
                <DateTime value={policy.effectiveFrom} variant="date" />
                {policy.effectiveTo ? (
                  <>
                    {' '}– <DateTime value={policy.effectiveTo} variant="date" />
                  </>
                ) : (
                  ' (open-ended)'
                )}
              </div>
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : policy.id)}
                className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-300"
              >
                {isOpen ? 'Hide detailed rules' : 'Show detailed rules'}
              </button>
              {isOpen && policy.rulesJson ? (
                <pre className="max-h-64 overflow-auto rounded bg-slate-900 p-3 text-[11px] text-slate-100">
                  {JSON.stringify(policy.rulesJson, null, 2)}
                </pre>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
};

export default PoliciesRoute;
