import React from 'react';

type Status = 'COMPLETED' | 'PENDING' | 'FAILED' | 'RETRYING' | 'PROCESSING' | string;

const statusStyles: Record<string, string> = {
  COMPLETED:  'bg-green-100 text-green-800',
  PENDING:    'bg-yellow-100 text-yellow-800',
  FAILED:     'bg-red-100 text-red-800',
  RETRYING:   'bg-orange-100 text-orange-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
};

export default function StatusBadge({ status }: { status: Status }) {
  const cls = statusStyles[status] ?? 'bg-gray-100 text-gray-800';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}
