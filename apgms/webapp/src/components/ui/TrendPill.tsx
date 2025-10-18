interface TrendPillProps {
  trend: 'up' | 'down' | 'steady';
}

const trendCopy: Record<TrendPillProps['trend'], { label: string; symbol: string }> = {
  up: { label: 'Improving', symbol: '⬆️' },
  down: { label: 'Declining', symbol: '⬇️' },
  steady: { label: 'Stable', symbol: '➡️' }
};

export const TrendPill = ({ trend }: TrendPillProps) => {
  const { label, symbol } = trendCopy[trend];
  return <span className={`trend-pill trend-pill--${trend}`}>{`${symbol} ${label}`}</span>;
};
