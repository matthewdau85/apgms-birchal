import type { PropsWithChildren, ReactNode } from 'react';

interface DataCardProps extends PropsWithChildren {
  title: string;
  action?: ReactNode;
}

export const DataCard = ({ title, action, children }: DataCardProps) => (
  <section className="data-card">
    <header className="data-card__header">
      <h3>{title}</h3>
      {action}
    </header>
    <div className="data-card__body">{children}</div>
  </section>
);
