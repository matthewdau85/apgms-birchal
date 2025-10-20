import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

export type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export const EmptyState = ({ title, description, action }: EmptyStateProps) => (
  <div className={styles.container} role="status" aria-live="polite">
    <h2>{title}</h2>
    <p>{description}</p>
    {action}
  </div>
);
