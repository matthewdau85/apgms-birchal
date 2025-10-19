import { FormEvent, useState } from 'react';
import { useRptById, useRptByLine } from '../lib/hooks';
import { DateTime } from '../ui/DateTime';
import { Skeleton } from '../ui/Skeleton';
import { Empty } from '../ui/Empty';
import { ErrorState } from '../ui/Error';

export const AuditRoute = () => {
  const [formState, setFormState] = useState({ rptId: '', bankLineId: '' });
  const [search, setSearch] = useState<{ rptId?: string; bankLineId?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const rptIdQuery = useRptById(search.rptId, { enabled: Boolean(search.rptId) });
  const lineQuery = useRptByLine(search.bankLineId, { enabled: Boolean(search.bankLineId) });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.rptId && !formState.bankLineId) {
      setFormError('Provide an RPT ID or a bank line reference.');
      return;
    }
    setFormError(null);
    setSearch({
      rptId: formState.rptId.trim() || undefined,
      bankLineId: formState.bankLineId.trim() || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm text-slate-600 dark:text-slate-300">
            RPT reference
            <input
              type="text"
              value={formState.rptId}
              onChange={(event) => setFormState((prev) => ({ ...prev, rptId: event.target.value }))}
              placeholder="Enter RPT identifier"
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            />
          </label>
          <label className="text-sm text-slate-600 dark:text-slate-300">
            Bank line reference
            <input
              type="text"
              value={formState.bankLineId}
              onChange={(event) => setFormState((prev) => ({ ...prev, bankLineId: event.target.value }))}
              placeholder="Enter line identifier"
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            />
          </label>
        </div>
        {formError ? <p className="mt-3 text-sm text-rose-500">{formError}</p> : null}
        <button
          type="submit"
          className="mt-4 inline-flex items-center rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
        >
          Search audit trail
        </button>
      </form>

      <section className="space-y-4">
        <AuditResultCard
          title="RPT verification"
          description="Verification status for the submitted RPT identifier."
          isFetching={rptIdQuery.isFetching}
          isError={rptIdQuery.isError}
          onRetry={() => rptIdQuery.refetch()}
          data={rptIdQuery.data}
          visible={Boolean(search.rptId)}
        />
        <AuditResultCard
          title="Line-based verification"
          description="Most recent verification for the bank line."
          isFetching={lineQuery.isFetching}
          isError={lineQuery.isError}
          onRetry={() => lineQuery.refetch()}
          data={lineQuery.data}
          visible={Boolean(search.bankLineId)}
        />
      </section>
    </div>
  );
};

type AuditResultCardProps = {
  title: string;
  description: string;
  isFetching: boolean;
  isError: boolean;
  onRetry: () => void;
  data: { status: string; verifiedAt?: string } | undefined;
  visible: boolean;
};

const AuditResultCard = ({ title, description, isFetching, isError, onRetry, data, visible }: AuditResultCardProps) => {
  if (!visible) {
    return null;
  }

  if (isFetching) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="mt-2 h-4 w-48" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState onRetry={onRetry}>
        Unable to retrieve verification data. Try again.
      </ErrorState>
    );
  }

  if (!data) {
    return <Empty>No verification entries yet.</Empty>;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
      <div className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">
        <div>
          Status: <span className="font-semibold text-slate-900 dark:text-slate-100">{data.status}</span>
        </div>
        {data.verifiedAt ? (
          <div>
            Verified <DateTime value={data.verifiedAt} />
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default AuditRoute;
