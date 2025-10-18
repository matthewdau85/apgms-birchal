import clsx from 'clsx';

interface StatusBadgeProps {
  label: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}

export const StatusBadge = ({ label, tone = 'default' }: StatusBadgeProps) => (
  <span className={clsx('status-badge', `status-badge--${tone}`)}>{label}</span>
);
