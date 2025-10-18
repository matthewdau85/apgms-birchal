import React from 'react';

type SectionCardProps = {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
};

const SectionCard: React.FC<SectionCardProps> = ({ title, subtitle, action, children }) => {
  return (
    <section className="section-card">
      <div className="section-card__header">
        <div>
          <h2 className="section-card__title">{title}</h2>
          {subtitle ? <p className="section-card__subtitle">{subtitle}</p> : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      {children}
    </section>
  );
};

export default SectionCard;
