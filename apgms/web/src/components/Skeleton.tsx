import type { HTMLAttributes } from 'react';
import React from 'react';

export type SkeletonProps = HTMLAttributes<HTMLDivElement> & {
  width?: string | number;
  height?: string | number;
  radius?: string | number;
};

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  radius = 'var(--apgms-radius-sm)',
  style,
  className,
  ...rest
}) => (
  <div
    role="presentation"
    aria-hidden="true"
    className={`apgms-skeleton ${className ?? ''}`.trim()}
    style={{
      background: 'linear-gradient(90deg, rgba(148, 163, 184, 0.1) 0%, rgba(148, 163, 184, 0.35) 50%, rgba(148, 163, 184, 0.1) 100%)',
      borderRadius: radius,
      width,
      height,
      animation: 'apgms-skeleton 1.6s ease-in-out infinite',
      ...style,
    }}
    {...rest}
  />
);
