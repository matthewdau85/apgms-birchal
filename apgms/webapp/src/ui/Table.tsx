import { ReactNode, useMemo, useState } from 'react';

type SortDirection = 'asc' | 'desc' | null;

type SortState<T> = {
  column: Column<T> | null;
  direction: SortDirection;
};

type Column<T> = {
  id: string;
  header: string;
  accessor?: (row: T) => ReactNode;
  value?: (row: T) => string | number | Date;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  headerClassName?: string;
  cellClassName?: string;
};

type TableProps<T> = {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: ReactNode;
  onRowClick?: (row: T) => void;
  getRowId?: (row: T, index: number) => string;
  getRowAriaLabel?: (row: T) => string;
};

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function defaultValue<T>(row: T): string | number | Date {
  return row as unknown as string | number | Date;
}

export function Table<T>({
  columns,
  data,
  emptyMessage = 'No data to display',
  onRowClick,
  getRowId,
  getRowAriaLabel,
}: TableProps<T>) {
  const [sortState, setSortState] = useState<SortState<T>>({ column: null, direction: null });

  const handleSort = (column: Column<T>) => {
    if (!column.sortable) {
      return;
    }

    setSortState((prev) => {
      if (prev.column?.id === column.id) {
        const nextDirection = prev.direction === 'asc' ? 'desc' : prev.direction === 'desc' ? null : 'asc';
        return { column: nextDirection ? column : null, direction: nextDirection };
      }
      return { column, direction: 'asc' };
    });
  };

  const sortedData = useMemo(() => {
    if (!sortState.column || !sortState.direction) {
      return data;
    }

    const { column } = sortState;
    const getValue = column.value ?? column.accessor ?? defaultValue;
    const direction = sortState.direction === 'asc' ? 1 : -1;

    return [...data].sort((a, b) => {
      const aValue = getValue(a);
      const bValue = getValue(b);

      if (aValue === bValue) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      if (aValue instanceof Date && bValue instanceof Date) {
        return (aValue.getTime() - bValue.getTime()) * direction;
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return (aValue - bValue) * direction;
      }

      return String(aValue).localeCompare(String(bValue)) * direction;
    });
  }, [data, sortState.column, sortState.direction]);

  if (!sortedData.length) {
    return <div role="status">{emptyMessage}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse" role="grid">
        <thead>
          <tr>
            {columns.map((column) => {
              const isSorted = sortState.column?.id === column.id && sortState.direction;
              const ariaSort = column.sortable
                ? isSorted
                  ? sortState.direction === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : 'none'
                : undefined;

              return (
                <th
                  key={column.id}
                  scope="col"
                  aria-sort={ariaSort as 'none' | 'ascending' | 'descending' | undefined}
                  className={`border-b border-gray-200 bg-gray-50 px-4 py-3 text-left text-sm font-semibold text-gray-700 ${column.headerClassName ?? ''}`.trim()}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() => handleSort(column)}
                      className="flex items-center gap-1 text-left"
                    >
                      <span>{column.header}</span>
                      <span aria-hidden="true" className="text-xs text-gray-500">
                        {isSorted ? (sortState.direction === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  ) : (
                    <span>{column.header}</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, index) => {
            const rowId = getRowId?.(row, index) ?? index.toString();
            const ariaLabel = getRowAriaLabel?.(row);
            return (
              <tr
                key={rowId}
                tabIndex={onRowClick ? 0 : undefined}
                className={`cursor-${onRowClick ? 'pointer hover:bg-gray-50 focus:bg-gray-100 focus:outline-none' : 'default'} border-b border-gray-100`}
                onClick={() => onRowClick?.(row)}
                onKeyDown={(event) => {
                  if (!onRowClick) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onRowClick(row);
                  }
                }}
                aria-label={ariaLabel}
                role={onRowClick ? 'button' : undefined}
              >
                {columns.map((column) => {
                  const content = column.accessor ? column.accessor(row) : (row as Record<string, ReactNode>)[column.id];
                  return (
                    <td
                      key={column.id}
                      className={`px-4 py-3 text-sm text-gray-700 ${column.cellClassName ?? ''}`.trim()}
                      style={{ textAlign: column.align ?? 'left' }}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector));
}
