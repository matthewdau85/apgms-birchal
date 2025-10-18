import type { PropsWithChildren, ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface CardProps extends PropsWithChildren {
  className?: string;
  header?: ReactNode;
  footer?: ReactNode;
}

export function Card({ className, header, footer, children }: CardProps) {
  return (
    <section className={cn('card', className)}>
      {header && <header className="card-header">{header}</header>}
      <div className="card-content">{children}</div>
      {footer && <footer className="card-footer">{footer}</footer>}
    </section>
  );
}
