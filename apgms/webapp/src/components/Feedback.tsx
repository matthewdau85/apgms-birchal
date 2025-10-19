import React from 'react';

type LoadingStateProps = {
  message?: string;
};

type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
};

export const LoadingState: React.FC<LoadingStateProps> = ({ message = 'Loading…' }) => (
  <div className="loading" role="status" aria-live="polite">
    {message}
  </div>
);

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'We could not load this data.',
  onRetry,
}) => (
  <div className="error" role="alert">
    <strong>{title}</strong>
    <p>{message}</p>
    {onRetry ? (
      <button type="button" onClick={onRetry}>
        Try again
      </button>
    ) : null}
  </div>
);
