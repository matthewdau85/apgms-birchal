import React from 'react';

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

const skeletonStyles = `
  :root[data-theme='light'] .skeleton {
    --skeleton-base: rgba(148, 163, 184, 0.32);
    --skeleton-highlight: rgba(148, 163, 184, 0.58);
  }
  :root[data-theme='dark'] .skeleton {
    --skeleton-base: rgba(148, 163, 184, 0.22);
    --skeleton-highlight: rgba(148, 163, 184, 0.45);
  }
  .skeleton {
    position: relative;
    overflow: hidden;
    background: linear-gradient(
      90deg,
      var(--skeleton-base) 25%,
      var(--skeleton-highlight) 37%,
      var(--skeleton-base) 63%
    );
    background-size: 400% 100%;
    animation: skeleton-shimmer 1.4s ease infinite;
  }
  @keyframes skeleton-shimmer {
    0% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0 50%;
    }
  }
`;

let skeletonStylesInjected = false;

const ensureSkeletonStyles = () => {
  if (skeletonStylesInjected || typeof document === 'undefined') {
    return;
  }

  const style = document.createElement('style');
  style.setAttribute('data-skeleton-styles', 'true');
  style.textContent = skeletonStyles;
  document.head.appendChild(style);
  skeletonStylesInjected = true;
};

const joinClassNames = (...values: Array<string | undefined>) =>
  values.filter(Boolean).join(' ');

const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  borderRadius = '0.75rem',
  className,
  style,
}) => {
  React.useEffect(() => {
    ensureSkeletonStyles();
  }, []);

  return (
    <span
      className={joinClassNames('skeleton', className)}
      style={{
        display: 'inline-block',
        width,
        height,
        borderRadius,
        ...style,
      }}
      role="presentation"
      aria-hidden="true"
    />
  );
};

export default Skeleton;
