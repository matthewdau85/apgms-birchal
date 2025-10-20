export function resolvePort(portFromEnv: string | undefined): number {
  const parsed = Number(portFromEnv);

  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return 3000;
}
