export function normalizeTake(input: unknown, fallback = 20): number {
  const numeric = Number(input ?? fallback);

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  const clamped = Math.min(Math.max(Math.trunc(numeric), 1), 200);
  return clamped;
}
