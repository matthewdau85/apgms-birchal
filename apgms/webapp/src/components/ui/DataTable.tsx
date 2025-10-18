import type { ReactNode } from 'react';

export interface Column<T> {
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  getRowKey: (row: T) => string;
  emptyState?: ReactNode;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({ data, columns, getRowKey, emptyState, onRowClick }: DataTableProps<T>) {
  if (!data.length) {
    return <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">{emptyState ?? 'No data available.'}</div>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((column, index) => (
              <th key={index} className={['px-4 py-3', column.className].filter(Boolean).join(' ')}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
          {data.map((row) => {
            const rowClasses = ['hover:bg-slate-50'];
            if (onRowClick) {
              rowClasses.push('cursor-pointer');
            }

            return (
              <tr key={getRowKey(row)} className={rowClasses.join(' ')} onClick={() => onRowClick?.(row)}>
                {columns.map((column, index) => (
                  <td key={index} className={['px-4 py-3 align-middle', column.className].filter(Boolean).join(' ')}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
