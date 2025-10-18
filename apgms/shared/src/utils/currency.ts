export function formatCurrency(amount: number, currency = "AUD"): string {
  const formatter = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  });
  return formatter.format(amount);
}

export function sum(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0);
}
