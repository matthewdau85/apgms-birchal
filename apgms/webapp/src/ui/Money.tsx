import React from 'react';

export const formatCentsToAud = (cents: number): string => {
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
};

export interface MoneyProps {
  cents?: number | null;
  className?: string;
  zeroPlaceholder?: string;
  nullPlaceholder?: React.ReactNode;
}

const joinClassNames = (...values: Array<string | undefined>) =>
  values.filter(Boolean).join(' ');

const Money: React.FC<MoneyProps> = ({
  cents,
  className,
  zeroPlaceholder = formatCentsToAud(0),
  nullPlaceholder = '—',
}) => {
  if (cents == null) {
    return <span className={joinClassNames('money', className)}>{nullPlaceholder}</span>;
  }

  if (cents === 0 && zeroPlaceholder) {
    return <span className={joinClassNames('money', className)}>{zeroPlaceholder}</span>;
  }

  return <span className={joinClassNames('money', className)}>{formatCentsToAud(cents)}</span>;
};

export default Money;
