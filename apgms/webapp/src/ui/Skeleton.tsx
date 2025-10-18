import { forwardRef } from 'react';

type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  shimmer?: boolean;
};

const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(function Skeleton(
  { className, shimmer = true, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      className={`animate-pulse rounded-md bg-muted ${shimmer ? 'bg-gradient-to-r from-muted via-card to-muted' : ''} ${
        className ?? ''
      }`.trim()}
      {...props}
    />
  );
});

export default Skeleton;
