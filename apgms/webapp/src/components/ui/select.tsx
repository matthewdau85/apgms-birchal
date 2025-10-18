import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, ...props },
  ref
) {
  return (
    <select ref={ref} className={cn('select', className)} {...props}>
      {children}
    </select>
  );
});
