import type { ReactNode } from 'react';
import React from 'react';

export type StatusMessageVariant = 'empty' | 'error';

export interface StatusMessageProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  variant?: StatusMessageVariant;
  id?: string;
}

export const StatusMessage: React.FC<StatusMessageProps> = ({
  icon,
  title,
  description,
  action,
  variant = 'empty',
  id,
}) => (
  <div
    role={variant === 'error' ? 'alert' : 'status'}
    aria-live={variant === 'error' ? 'assertive' : 'polite'}
    className="apgms-status-message"
    data-variant={variant}
    id={id}
  >
    {icon ? <span aria-hidden="true">{icon}</span> : null}
    <div>
      <p style={{
        margin: 0,
        fontWeight: 'var(--apgms-typography-weight-semibold)',
        fontSize: 'var(--apgms-typography-size-md)',
      }}>
        {title}
      </p>
      {description ? (
        <p
          style={{
            margin: 'var(--apgms-spacing-xs) 0 0 0',
            color: 'var(--apgms-color-text-secondary)',
          }}
        >
          {description}
        </p>
      ) : null}
    </div>
    {action}
  </div>
);
