import { useMemo, useState } from 'react';
import { createRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { Banknote } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getBankLineDetail, getBankLines, type BankLine } from '@/lib/api';
import { rootRoute } from '@/routes/__root';

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function useBankLineColumns(): ColumnDef<BankLine>[] {
  return useMemo(
    () => [
      {
        accessorKey: 'institution',
        header: 'Institution',
        cell: ({ row }) => (
          <div>
            <div className="font-medium">{row.original.institution}</div>
            <p className="text-xs text-muted-foreground">{row.original.country}</p>
          </div>
        ),
      },
      {
        accessorKey: 'limit',
        header: 'Limit',
        cell: ({ row }) => formatCurrency(row.original.limit, row.original.currency),
      },
      {
        accessorKey: 'utilised',
        header: 'Utilised',
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <span>{formatCurrency(row.original.utilised, row.original.currency)}</span>
            <span className="text-xs text-muted-foreground">
              {Math.round((row.original.utilised / row.original.limit) * 100)}% utilised
            </span>
          </div>
        ),
      },
      {
        accessorKey: 'effectiveDate',
        header: 'Term',
        cell: ({ row }) => (
          <div className="text-sm text-muted-foreground">
            {new Date(row.original.effectiveDate).toLocaleDateString()} –{' '}
            {new Date(row.original.expiryDate).toLocaleDateString()}
          </div>
        ),
      },
      {
        id: 'actions',
        header: '',
        size: 80,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button variant="outline" size="sm">
              View
            </Button>
          </div>
        ),
      },
    ],
    []
  );
}

function BankLineDetailDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['bank-line', id],
    queryFn: () => getBankLineDetail(id!),
    enabled: Boolean(id),
  });

  return (
    <Sheet open={Boolean(id)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5" /> Bank line details
          </SheetTitle>
          <SheetDescription>
            Detailed policy and RPT information for the selected facility.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4">
          {isLoading && <p className="text-sm text-muted-foreground">Loading line information…</p>}
          {isError && (
            <p className="text-sm text-destructive">
              {(error as Error).message || 'Unable to load bank line detail.'}
            </p>
          )}
          {data && (
            <div className="space-y-6 text-sm">
              <div>
                <h3 className="text-base font-semibold">Facility</h3>
                <dl className="mt-2 space-y-1 text-muted-foreground">
                  <div className="flex justify-between gap-4">
                    <dt>Institution</dt>
                    <dd className="text-right font-medium text-foreground">{data.institution}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Limit</dt>
                    <dd className="text-right font-medium text-foreground">
                      {formatCurrency(data.limit, data.currency)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Utilised</dt>
                    <dd className="text-right font-medium text-foreground">
                      {formatCurrency(data.utilised, data.currency)} ({Math.round((data.utilised / data.limit) * 100)}%)
                    </dd>
                  </div>
                </dl>
              </div>
              <div>
                <h3 className="text-base font-semibold">Policy</h3>
                <dl className="mt-2 space-y-1 text-muted-foreground">
                  <div className="flex justify-between gap-4">
                    <dt>Policy number</dt>
                    <dd className="text-right font-medium text-foreground">{data.policy.number}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Status</dt>
                    <dd className="text-right font-medium capitalize text-foreground">{data.policy.status}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Coverage</dt>
                    <dd className="text-right font-medium text-foreground">
                      {data.policy.coveragePercentage}% ({formatCurrency(data.policy.coverageAmount, data.currency)})
                    </dd>
                  </div>
                </dl>
              </div>
              <div>
                <h3 className="text-base font-semibold">Risk participation</h3>
                <dl className="mt-2 space-y-1 text-muted-foreground">
                  <div className="flex justify-between gap-4">
                    <dt>RPT number</dt>
                    <dd className="text-right font-medium text-foreground">{data.participation.rptNumber}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt>Participation</dt>
                    <dd className="text-right font-medium text-foreground">
                      {data.participation.participationPercentage}%
                    </dd>
                  </div>
                  {data.participation.notes && (
                    <div className="flex flex-col gap-1 text-right">
                      <dt className="text-left">Notes</dt>
                      <dd className="text-left text-foreground">{data.participation.notes}</dd>
                    </div>
                  )}
                </dl>
              </div>
              {data.comments && (
                <div>
                  <h3 className="text-base font-semibold">Comments</h3>
                  <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{data.comments}</p>
                </div>
              )}
            </div>
          )}
        </div>
        <SheetFooter>
          <SheetClose asChild>
            <Button variant="outline" className="w-full">
              Close
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function BankLinesPage() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const columns = useBankLineColumns();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['bank-lines'],
    queryFn: getBankLines,
  });

  const table = useReactTable({
    data: data ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">Bank lines</h1>
        <p className="text-muted-foreground">
          Manage policy structures and risk participation agreements across counterparties.
        </p>
      </div>
      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Facilities overview</CardTitle>
            <CardDescription>Click a row to review policy and RPT details.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="cursor-pointer" onClick={header.column.getToggleSortingHandler()}>
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      Loading bank lines…
                    </TableCell>
                  </TableRow>
                )}
                {isError && (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center text-destructive">
                      {(error as Error).message || 'Unable to load bank lines.'}
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && !isError && table.getRowModel().rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      No bank lines available.
                    </TableCell>
                  </TableRow>
                )}
                {table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedLine(row.original.id)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <BankLineDetailDrawer id={selectedLine} onClose={() => setSelectedLine(null)} />
    </div>
  );
}

export const bankLinesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/bank-lines',
  component: BankLinesPage,
});
