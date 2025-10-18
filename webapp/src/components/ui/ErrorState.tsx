import { Button } from './Button';
import styles from './ErrorState.module.css';

type ErrorStateProps = {
  title: string;
  description: string;
  onRetry?: () => void;
};

export const ErrorState = ({ title, description, onRetry }: ErrorStateProps) => (
  <div className={styles.container} role="alert">
    <h2>{title}</h2>
    <p>{description}</p>
    {onRetry && (
      <Button variant="outline" onClick={onRetry} type="button">
        Try again
      </Button>
    )}
  </div>
);
