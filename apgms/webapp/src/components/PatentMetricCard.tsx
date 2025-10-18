import React from 'react';

type PatentMetricCardProps = {
  label: string;
  value: string;
  trend?: string;
  variant?: 'primary' | 'neutral';
  context?: string;
};

const PatentMetricCard: React.FC<PatentMetricCardProps> = ({
  label,
  value,
  trend,
  variant = 'primary',
  context,
}) => {
  const className = ['metric-card', variant === 'neutral' ? 'metric-card--neutral' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <article className={className}>
      <span className="metric-card__label">{label}</span>
      <span className="metric-card__value">{value}</span>
      {trend ? <span className="metric-card__trend">{trend}</span> : null}
      {context ? <small>{context}</small> : null}
    </article>
  );
};

export default PatentMetricCard;
