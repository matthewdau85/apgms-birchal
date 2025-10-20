import { useMemo, useState } from 'react';
import {
  ColumnDef,
  PaginationState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table';
import { formatDistanceToNow } from 'date-fns';
import { CheckCircle2, Clock3, TriangleAlert } from 'lucide-react';
import { BankLine } from '../../data/dashboardData';
import { Button } from '../ui/Button';
import styles from './BankLinesTable.module.css';
import { VerifyModal } from './VerifyModal';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);

const STATUS_ICON: Record<BankLine['rptStatus'], React.ReactNode> = {
  pending: <Clock3 aria-hidden />,
  verified: <CheckCircle2 aria-hidden />,
  flagged: <TriangleAlert aria-hidden />
};

const STATUS_LABEL: Record<BankLine['rptStatus'], string> = {
  pending: 'Pending',
  verified: 'Verified',
  flagged: 'Flagged'
};

type BankLinesTableProps = {
  data: BankLine[];
  onVerify: (id: string) => Promise<void>;
};

export const BankLinesTable = ({ data, onVerify }: BankLinesTableProps) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 4 });
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const columns = useMemo<ColumnDef<BankLine>[]>(
    () => [
      {
        accessorKey: 'bank',
        header: () => 'Bank',
        cell: (info) => info.getValue<string>()
      },
      {
        accessorKey: 'product',
        header: () => 'Product',
        cell: (info) => info.getValue<string>()
      },
      {
        accessorKey: 'limit',
        header: () => 'Limit',
        cell: (info) => formatCurrency(info.getValue<number>())
      },
      {
        accessorKey: 'utilized',
        header: () => 'Utilized',
        cell: (info) => formatCurrency(info.getValue<number>())
      },
      {
        accessorKey: 'rptStatus',
        header: () => 'RPT Status',
        cell: (info) => {
          const value = info.getValue<BankLine['rptStatus']>();
          return (
            <span className={styles.status} data-status={value}>
              {STATUS_ICON[value]}
              {STATUS_LABEL[value]}
            </span>
          );
        }
      },
      {
        accessorKey: 'updatedAt',
        header: () => 'Updated',
        cell: (info) => formatDistanceToNow(new Date(info.getValue<string>()), { addSuffix: true })
      },
      {
        id: 'actions',
        header: () => 'Actions',
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setVerifyingId(row.original.id)}
            disabled={row.original.rptStatus === 'verified'}
          >
            {row.original.rptStatus === 'verified' ? 'Verified' : 'Verify RPT'}
          </Button>
        )
      }
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  });

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} scope="col">
                  {header.isPlaceholder ? null : header.column.getCanSort() ? (
                    <button
                      type="button"
                      className={styles.headerButton}
                      onClick={header.column.getToggleSortingHandler()}
                      aria-label={`Sort by ${
                        typeof header.column.columnDef.header === 'function'
                          ? header.column.columnDef.header(header.getContext())
                          : header.column.columnDef.header
                      }`}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {{
                        asc: ' ▲',
                        desc: ' ▼'
                      }[header.column.getIsSorted() as string] ?? ''}
                    </button>
                  ) : (
                    flexRender(header.column.columnDef.header, header.getContext())
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  data-label={
                    typeof cell.column.columnDef.header === 'function'
                      ? cell.column.columnDef.header(cell.getContext())
                      : cell.column.columnDef.header
                  }
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {data.length === 0 && (
        <div className={styles.emptyOverlay}>No bank lines to display.</div>
      )}
      <div className={styles.pagination} role="group" aria-label="Pagination controls">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <span>
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>
      <VerifyModal
        open={Boolean(verifyingId)}
        onOpenChange={() => setVerifyingId(null)}
        onConfirm={async () => {
          if (!verifyingId) return;
          await onVerify(verifyingId);
          setVerifyingId(null);
        }}
      />
    </div>
  );
};
