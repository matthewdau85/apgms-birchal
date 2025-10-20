import { TrendingDown, TrendingUp } from 'lucide-react';
import { Card } from '../ui/Card';
import styles from './KpiSummaryCard.module.css';

type Direction = 'up' | 'down' | 'neutral';

export type KpiSummary = {
  label: string;
  value: string;
  delta: string;
  direction: Direction;
};

type KpiSummaryCardProps = {
  summary: KpiSummary;
};

export const KpiSummaryCard = ({ summary }: KpiSummaryCardProps) => {
  const { direction, label, value, delta } = summary;

  return (
    <Card className={styles.card} aria-live="polite">
      <div>
        <p className={styles.label}>{label}</p>
        <p className={styles.value}>{value}</p>
      </div>
      <div className={styles.delta} data-direction={direction}>
        {direction === 'up' && <TrendingUp aria-hidden />} 
        {direction === 'down' && <TrendingDown aria-hidden />} 
        <span>{delta}</span>
      </div>
    </Card>
  );
};
