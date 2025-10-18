import React, { useEffect, useId } from 'react';
import { ErrorBoundary } from './ErrorBoundary.js';
import { Skeleton } from './Skeleton.js';
import { StatusMessage } from './StatusMessage.js';
import { injectComponentStyles } from './styles.js';

export interface DataListProps<T> {
  items: T[];
  isLoading?: boolean;
  error?: Error | null;
  emptyMessage?: {
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
  };
  loadingSkeletonCount?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  getKey?: (item: T, index: number) => React.Key;
  ariaLabel?: string;
  onRetry?: () => void;
}

const LoadingState: React.FC<{ count: number; labelledBy: string; id?: string }> = ({
  count,
  labelledBy,
  id,
}) => (
  <div id={id} role="status" aria-labelledby={labelledBy} aria-live="polite" aria-busy="true">
    {Array.from({ length: count }).map((_, index) => (
      <Skeleton key={index} height="3rem" style={{ marginBottom: 'var(--apgms-spacing-sm)' }} />
    ))}
  </div>
);

const EmptyState: React.FC<{
  messageId: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}> = ({ messageId, title, description, actionLabel, onAction }) => (
  <StatusMessage
    id={messageId}
    title={title}
    description={description}
    action={
      actionLabel ? (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : undefined
    }
  />
);

const ErrorState: React.FC<{ messageId: string; error: Error; onRetry?: () => void }> = ({
  messageId,
  error,
  onRetry,
}) => (
  <StatusMessage
    id={messageId}
    variant="error"
    title="We could not load your data"
    description={error.message}
    action={
      onRetry ? (
        <button type="button" onClick={onRetry}>
          Try again
        </button>
      ) : undefined
    }
  />
);

export function DataList<T>({
  items,
  isLoading = false,
  error = null,
  emptyMessage = {
    title: 'No items to show',
    description: 'Once data is available, it will appear here.',
  },
  loadingSkeletonCount = 3,
  renderItem,
  getKey,
  ariaLabel,
  onRetry,
}: DataListProps<T>) {
  const headingId = useId();
  const emptyMessageId = useId();
  const errorMessageId = useId();
  const loadingMessageId = useId();

  useEffect(() => {
    if (typeof document !== 'undefined') {
      injectComponentStyles();
    }
  }, []);

  const describedBy = isLoading
    ? loadingMessageId
    : error
      ? errorMessageId
      : items.length === 0
        ? emptyMessageId
        : undefined;

  return (
    <section
      className="apgms-card"
      aria-busy={isLoading ? 'true' : undefined}
      aria-live="polite"
      aria-labelledby={headingId}
      aria-describedby={describedBy}
      aria-label={ariaLabel}
    >
      <h2 id={headingId}>Latest activity</h2>
      <ErrorBoundary
        fallback={
          <StatusMessage
            id={errorMessageId}
            variant="error"
            title="We could not load your data"
            description="An unexpected error occurred while rendering this list."
            action={
              onRetry ? (
                <button type="button" onClick={onRetry}>
                  Try again
                </button>
              ) : undefined
            }
          />
        }
        resetKeys={[items, isLoading, error]}
      >
        {isLoading ? (
          <LoadingState id={loadingMessageId} count={loadingSkeletonCount} labelledBy={headingId} />
        ) : error ? (
          <ErrorState messageId={errorMessageId} error={error} onRetry={onRetry} />
        ) : items.length === 0 ? (
          <EmptyState
            messageId={emptyMessageId}
            title={emptyMessage.title}
            description={emptyMessage.description}
            actionLabel={emptyMessage.actionLabel}
            onAction={emptyMessage.onAction}
          />
        ) : (
          <ul className="apgms-data-list" role="list">
            {items.map((item, index) => (
              <li key={getKey?.(item, index) ?? index}>{renderItem(item, index)}</li>
            ))}
          </ul>
        )}
      </ErrorBoundary>
    </section>
  );
}
