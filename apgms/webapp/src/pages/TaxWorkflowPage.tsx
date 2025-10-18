import { useMemo, useState } from 'react';

import { StatusBadge } from '../components/ui/StatusBadge';
import { useAppStore } from '../store/appStore';

const statusTone = {
  draft: 'default',
  'in-progress': 'warning',
  filed: 'success',
  'awaiting-review': 'warning'
} as const;

const statusLabel = {
  draft: 'Draft',
  'in-progress': 'In progress',
  filed: 'Filed',
  'awaiting-review': 'Awaiting review'
} as const;

export const TaxWorkflowPage = () => {
  const taxWorkflows = useAppStore((state) => state.taxWorkflows);
  const [statusFilter, setStatusFilter] = useState<'all' | keyof typeof statusLabel>('all');
  const [search, setSearch] = useState('');

  const filteredWorkflows = useMemo(() => {
    return taxWorkflows.filter((workflow) => {
      const matchesStatus =
        statusFilter === 'all' ? true : workflow.status === statusFilter;
      const matchesSearch = `${workflow.jurisdiction} ${workflow.filingType} ${workflow.owner}`
        .toLowerCase()
        .includes(search.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [search, statusFilter, taxWorkflows]);

  return (
    <div className="page">
      <header className="page__header">
        <div>
          <h1>Tax workflows</h1>
          <p>Monitor filing progress and ownership across your active tax workflows.</p>
        </div>
        <div className="filters">
          <label>
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
            >
              <option value="all">All statuses</option>
              {Object.entries(statusLabel).map(([status, label]) => (
                <option key={status} value={status}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Search</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by jurisdiction, filing or owner"
            />
          </label>
        </div>
      </header>

      <section className="panel">
        {filteredWorkflows.length === 0 ? (
          <p>No workflows match your filters.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Jurisdiction</th>
                <th>Filing</th>
                <th>Due date</th>
                <th>Status</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {filteredWorkflows.map((workflow) => (
                <tr key={workflow.id}>
                  <td>{workflow.jurisdiction}</td>
                  <td>{workflow.filingType}</td>
                  <td>{new Date(workflow.dueDate).toLocaleDateString()}</td>
                  <td>
                    <StatusBadge
                      label={statusLabel[workflow.status]}
                      tone={statusTone[workflow.status] as 'default' | 'success' | 'warning'}
                    />
                  </td>
                  <td>{workflow.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};
