const formatter = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  minimumFractionDigits: 2,
});

export function Money({ value }: { value: number }) {
  return <span>{formatter.format(value)}</span>;
}
